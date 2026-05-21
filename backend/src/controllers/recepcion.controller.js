const pool = require('../config/db');

// --- PACIENTES ---

const buscarPaciente = async (req, res) => {
  const { cedula } = req.params; // this is now just a query string
  const filtro = req.query.filtro || 'todo';
  try {
    let result;
    const busquedaLimpia = (cedula || '').toString().toUpperCase().trim();

    if (filtro === 'nombre') {
      result = await pool.query('SELECT * FROM "Pacientes" WHERE nombre ILIKE $1 AND id_sede = $2', [`%${busquedaLimpia}%`, req.usuario.id_sede]);
    } else if (filtro === 'apellido') {
      result = await pool.query('SELECT * FROM "Pacientes" WHERE apellido ILIKE $1 AND id_sede = $2', [`%${busquedaLimpia}%`, req.usuario.id_sede]);
    } else if (filtro === 'cedula') {
      const cedulaSoloNumeros = busquedaLimpia.replace(/\D/g, '');
      result = await pool.query('SELECT * FROM "Pacientes" WHERE cedula ILIKE $1 AND id_sede = $2', [`%${cedulaSoloNumeros}%`, req.usuario.id_sede]);
    } else {
      result = await pool.query(
        'SELECT * FROM "Pacientes" WHERE (cedula ILIKE $1 OR nombre ILIKE $1 OR apellido ILIKE $1 OR CONCAT(nombre, \' \', apellido) ILIKE $1) AND id_sede = $2',
        [`%${busquedaLimpia}%`, req.usuario.id_sede]
      );
    }
    
    if (result.rows.length === 0) return res.status(404).json({ mensaje: 'Pacientes no encontrados' });
    res.json(result.rows); // Return array
  } catch (error) {
    console.error('Error al buscar paciente:', error);
    res.status(500).json({ mensaje: 'Error al buscar paciente' });
  }
};

const crearPaciente = async (req, res) => {
  let { cedula, nombre, apellido, telefono, status, notificaciones_sms } = req.body;
  
  try {
    // Sanitización, Formateo estricto y TRIM
    const cedulaLimpia = (cedula || Date.now().toString()).toString().replace(/\D/g, '').trim();
    const nombreMayus = (nombre || 'PACIENTE').toString().toUpperCase().trim();
    const apellidoMayus = (apellido || 'NUEVO').toString().toUpperCase().trim();
    const telefonoLimpio = telefono ? telefono.toString().replace(/\D/g, '').trim() : null;

    const result = await pool.query(
      'INSERT INTO "Pacientes" (cedula, nombre, apellido, telefono, status, notificaciones_sms, id_sede) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [cedulaLimpia, nombreMayus, apellidoMayus, telefonoLimpio, status ?? true, notificaciones_sms ?? true, req.usuario.id_sede]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('--- ERROR AL CREAR PACIENTE ---');
    console.error('Error:', error);
    res.status(500).json({ mensaje: 'Error al registrar paciente' });
  }
};

// --- ATENCIÓN / TURNOS ---

const getResponsablesPago = async (req, res) => {
  try {
    const result = await pool.query('SELECT id_responsable as id, nombre FROM "Responsable_Pago" WHERE status = true');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener responsables de pago' });
  }
};

const registrarAtencion = async (req, res) => {
  const { id_paciente, id_servicio, id_especialidad, id_responsable, id_cliente } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Validar el servicio/especialidad
    let id_servicio_final = id_servicio;
    let prefijo = 'TK';
    
    if (id_especialidad) {
        const espRes = await client.query('SELECT s.prefijo FROM "Especialidades" e JOIN "Servicio" s ON e.id_servicio = s.id_servicio WHERE e.id_especialidad = $1 FOR UPDATE', [id_especialidad]);
        if (espRes.rows.length === 0) throw new Error('Especialidad no encontrada');
        prefijo = espRes.rows[0].prefijo;
    } else {
        const servRes = await client.query('SELECT prefijo FROM "Servicio" WHERE id_servicio = $1 FOR UPDATE', [id_servicio]);
        if (servRes.rows.length === 0) throw new Error('Servicio no encontrado');
        prefijo = servRes.rows[0].prefijo;
    }

    // 2. Generar número secuencial del día
    const ultimoRes = await client.query(`
      SELECT numero FROM "Atencion" 
      WHERE id_servicio = $1 
      AND DATE(hora_llegada) = CURRENT_DATE 
      ORDER BY id_atencion DESC LIMIT 1
    `, [id_servicio]);

    let siguiente = 1;
    if (ultimoRes.rows.length > 0 && ultimoRes.rows[0].numero) {
      const partes = ultimoRes.rows[0].numero.split('-');
      if (partes.length === 2) siguiente = parseInt(partes[1], 10) + 1;
    }
    const nuevoNumero = `${prefijo || 'TK'}-${siguiente.toString().padStart(3, '0')}`.replace(/\s/g, '');

    // 3. Obtener el estado inicial (ID 1)
    const estadoResult = await client.query('SELECT id_estado FROM "Estado" WHERE nombre_estado = $1', ['Espera']);
    const id_estado_inicial = estadoResult.rows[0]?.id_estado || 1;

    // 4. Crear el registro en Atencion con el número generado (incluyendo id_especialidad)
    const atencionResult = await client.query(
      `INSERT INTO "Atencion" (id_paciente, id_servicio, id_especialidad, id_responsable, id_estado_actual, id_usuario_registro, id_sede, numero, id_cliente) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id_atencion`,
      [id_paciente, id_servicio, id_especialidad || null, id_responsable, id_estado_inicial, req.usuario?.id || 1, req.usuario.id_sede, nuevoNumero, id_cliente || null]
    );
    const id_atencion = atencionResult.rows[0].id_atencion;

    // 5. Crear el primer hito en Historial_Atencion
    await client.query(
      `INSERT INTO "Historial_Atencion" (id_atencion, id_estado) 
       VALUES ($1, $2)`,
      [id_atencion, id_estado_inicial]
    );

    await client.query('COMMIT');
    res.status(201).json({ mensaje: 'Atención registrada correctamente', id_atencion, numero: nuevoNumero });
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    console.error('--- ERROR AL REGISTRAR ATENCION ---');
    console.error('Error:', error);
    res.status(500).json({ 
      mensaje: 'Error al procesar la atención', 
      error: error.message 
    });
  } finally {
    client.release();
  }
};

const getTurnosSalaEspera = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.id_atencion, p.nombre, p.apellido, 
             COALESCE(e.nombre, s.nombre_servicio) as nombre_servicio, 
             es.nombre_estado,
             c.nombre as consultorio_nombre
      FROM "Atencion" a
      JOIN "Pacientes" p ON a.id_paciente = p.id_paciente
      JOIN "Servicio" s ON a.id_servicio = s.id_servicio
      LEFT JOIN "Especialidades" e ON a.id_especialidad = e.id_especialidad
      JOIN "Estado" es ON a.id_estado_actual = es.id_estado
      LEFT JOIN "Consultorios" c ON a.id_consultorio = c.id_consultorio
      WHERE es.nombre_estado IN ('Espera', 'Atendiendo')
      AND a.hora_salida IS NULL
      AND a.id_sede = $1
      ORDER BY a.id_atencion DESC
      LIMIT 10
    `, [req.usuario.id_sede]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error sala espera:', error);
    res.status(500).json({ mensaje: 'Error al obtener turnos' });
  }
};

const getUltimasAdmisiones = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        p.nombre, 
        p.apellido, 
        p.cedula, 
        p.telefono, 
        p.notificaciones_sms as mensaje,
        COALESCE(e.nombre, s.nombre_servicio) as nombre_servicio, 
        COALESCE(a.hora_llegada, p.fecha_creacion) as fecha_creacion, 
        CASE 
          WHEN a.id_responsable = 2 AND cl.nombre IS NOT NULL THEN cl.nombre
          ELSE COALESCE(rp.nombre, 'PENDIENTE')
        END as modalidad_pago,
        a.id_atencion,
        p.id_paciente,
        a.id_servicio,
        a.id_especialidad,
        a.id_responsable,
        a.id_cliente
      FROM "Pacientes" p
      LEFT JOIN "Atencion" a ON p.id_paciente = a.id_paciente AND (a.id_estado_actual IN (1, 2, 3) OR a.id_estado_actual IS NULL)
      LEFT JOIN "Servicio" s ON a.id_servicio = s.id_servicio
      LEFT JOIN "Especialidades" e ON a.id_especialidad = e.id_especialidad
      LEFT JOIN "Responsable_Pago" rp ON a.id_responsable = rp.id_responsable
      LEFT JOIN "cliente" cl ON a.id_cliente = cl.id_cliente
      WHERE p.id_sede = $1
      ORDER BY 7 DESC
      LIMIT 20
    `, [req.usuario.id_sede]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error ultimas admisiones:', error);
    res.status(500).json({ mensaje: 'Error al obtener historial' });
  }
};

const actualizarPaciente = async (req, res) => {
  const { id_paciente } = req.params;
  const { nombre, apellido, cedula, telefono, notificaciones_sms } = req.body;
  try {
    const nombreMayus = (nombre || '').toString().toUpperCase().trim();
    const apellidoMayus = (apellido || '').toString().toUpperCase().trim();
    const cedulaLimpia = (cedula || '').toString().replace(/\D/g, '').trim();
    const telefonoLimpio = (telefono || '').toString().replace(/\D/g, '').trim();

    await pool.query(
      'UPDATE "Pacientes" SET nombre = $1, apellido = $2, cedula = $3, telefono = $4, notificaciones_sms = $5 WHERE id_paciente = $6 AND id_sede = $7',
      [nombreMayus, apellidoMayus, cedulaLimpia, telefonoLimpio, notificaciones_sms, id_paciente, req.usuario.id_sede]
    );
    res.json({ mensaje: 'Paciente actualizado correctamente' });
  } catch (error) {
    console.error('Error al actualizar paciente:', error);
    res.status(500).json({ mensaje: 'Error al actualizar paciente' });
  }
};

const actualizarAtencion = async (req, res) => {
  const { id_atencion } = req.params;
  const { id_servicio, id_responsable, id_cliente } = req.body;
  try {
    // Si cambia el servicio, NO cambiamos el número del ticket por seguridad y consistencia
    await pool.query(
      'UPDATE "Atencion" SET id_servicio = $1, id_responsable = $2, id_cliente = $3 WHERE id_atencion = $4 AND id_sede = $5',
      [id_servicio, id_responsable, id_cliente || null, id_atencion, req.usuario.id_sede]
    );
    res.json({ mensaje: 'Atención actualizada correctamente' });
  } catch (error) {
    console.error('Error al actualizar atención:', error);
    res.status(500).json({ mensaje: 'Error al actualizar atención' });
  }
};

const eliminarAtencion = async (req, res) => {
  const { id_atencion } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Borrar historial primero por FK
    await client.query('DELETE FROM "Historial_Atencion" WHERE id_atencion = $1', [id_atencion]);
    await client.query('DELETE FROM "Atencion" WHERE id_atencion = $1 AND id_sede = $2', [id_atencion, req.usuario.id_sede]);
    await client.query('COMMIT');
    res.json({ mensaje: 'Atención eliminada correctamente' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al eliminar atención:', error);
    res.status(500).json({ mensaje: 'Error al eliminar atención' });
  } finally {
    client.release();
  }
};

const eliminarPaciente = async (req, res) => {
  const { id_paciente } = req.params;
  try {
    // Solo permitimos eliminar si no tiene atenciones relacionadas (o borrarlas en cascada)
    // Por seguridad, si tiene atenciones, no dejamos borrar al paciente directo
    const check = await pool.query('SELECT COUNT(*) FROM "Atencion" WHERE id_paciente = $1', [id_paciente]);
    if (parseInt(check.rows[0].count) > 0) {
      return res.status(400).json({ mensaje: 'No se puede eliminar un paciente que tiene historial de atenciones' });
    }
    await pool.query('DELETE FROM "Pacientes" WHERE id_paciente = $1 AND id_sede = $2', [id_paciente, req.usuario.id_sede]);
    res.json({ mensaje: 'Paciente eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar paciente:', error);
    res.status(500).json({ mensaje: 'Error al eliminar paciente' });
  }
};

const actualizarEstadoAtencion = async (req, res) => {
  const { id_atencion } = req.params;
  const { id_estado_nuevo } = req.body;
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 1. Actualizar el estado en Atencion
    const atencionResult = await client.query(
      `UPDATE "Atencion" 
       SET id_estado_actual = $1 
       WHERE id_atencion = $2 AND id_sede = $3 
       RETURNING *`,
      [id_estado_nuevo, id_atencion, req.usuario.id_sede]
    );

    if (atencionResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ mensaje: 'Atención no encontrada' });
    }

    // 2. Registrar el cambio en Historial_Atencion
    await client.query(
      `INSERT INTO "Historial_Atencion" (id_atencion, id_estado) VALUES ($1, $2)`,
      [id_atencion, id_estado_nuevo]
    );

    await client.query('COMMIT');
    res.json({ mensaje: 'Estado actualizado correctamente', atencion: atencionResult.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al actualizar estado:', error);
    res.status(500).json({ mensaje: 'Error al actualizar estado', error: error.message });
  } finally {
    client.release();
  }
};

module.exports = {
  buscarPaciente,
  crearPaciente,
  getResponsablesPago,
  registrarAtencion,
  getTurnosSalaEspera,
  getUltimasAdmisiones,
  actualizarEstadoAtencion,
  actualizarPaciente,
  actualizarAtencion,
  eliminarAtencion,
  eliminarPaciente
};
