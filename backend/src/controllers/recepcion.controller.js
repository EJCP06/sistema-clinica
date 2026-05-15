const pool = require('../config/db');

// --- PACIENTES ---

const buscarPaciente = async (req, res) => {
  const { cedula } = req.params; // this is now just a query string
  const filtro = req.query.filtro || 'todo';
  try {
    let result;
    if (filtro === 'nombre') {
      result = await pool.query('SELECT * FROM "Pacientes" WHERE nombre ILIKE $1 AND id_sede = $2', [`%${cedula}%`, req.usuario.id_sede]);
    } else if (filtro === 'apellido') {
      result = await pool.query('SELECT * FROM "Pacientes" WHERE apellido ILIKE $1 AND id_sede = $2', [`%${cedula}%`, req.usuario.id_sede]);
    } else if (filtro === 'cedula') {
      result = await pool.query('SELECT * FROM "Pacientes" WHERE cedula = $1 AND id_sede = $2', [cedula, req.usuario.id_sede]);
    } else {
      result = await pool.query('SELECT * FROM "Pacientes" WHERE (cedula = $1 OR nombre ILIKE $2 OR apellido ILIKE $2) AND id_sede = $3', [cedula, `%${cedula}%`, req.usuario.id_sede]);
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
    // Sanitización y Formateo con protección contra nulos
    const cedulaLimpia = (cedula || Date.now().toString()).toString().replace(/\D/g, '');
    const nombreMayus = (nombre || 'PACIENTE').toUpperCase().trim();
    const apellidoMayus = (apellido || 'NUEVO').toUpperCase().trim();
    const telefonoLimpio = telefono ? telefono.toString().replace(/\D/g, '') : null;

    const result = await pool.query(
      'INSERT INTO "Pacientes" (cedula, nombre, apellido, telefono, status, notificaciones_sms, id_sede) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [cedulaLimpia, nombreMayus, apellidoMayus, telefonoLimpio, status ?? true, notificaciones_sms ?? true, req.usuario.id_sede]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error al crear paciente:', error);
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
  const { id_paciente, id_servicio, id_responsable } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Obtener el estado inicial (ej: 'Registro' o el ID 1)
    const estadoResult = await client.query('SELECT id_estado FROM "Estado" WHERE nombre_estado = $1', ['Registro']);
    const id_estado_inicial = estadoResult.rows[0]?.id_estado || 1;

    // 2. Crear el registro en Atencion
    const atencionResult = await client.query(
      `INSERT INTO "Atencion" (id_paciente, id_servicio, id_responsable, id_estado_actual, id_usuario_registro, id_sede) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id_atencion`,
      [id_paciente, id_servicio, id_responsable, id_estado_inicial, req.usuario?.id || 1, req.usuario.id_sede]
    );
    const id_atencion = atencionResult.rows[0].id_atencion;

    // 3. Crear el primer hito en Historial_Atencion
    await client.query(
      `INSERT INTO "Historial_Atencion" (id_atencion, id_estado, id_sede) 
       VALUES ($1, $2, $3)`,
      [id_atencion, id_estado_inicial, req.usuario.id_sede]
    );

    await client.query('COMMIT');
    res.status(201).json({ mensaje: 'Atención registrada correctamente', id_atencion });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al registrar atención:', error);
    res.status(500).json({ mensaje: 'Error al procesar la atención' });
  } finally {
    client.release();
  }
};

const getTurnosSalaEspera = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.id_atencion, p.nombre, p.apellido, s.nombre_servicio, e.nombre_estado,
             (SELECT nombre FROM "Consultorios" WHERE id_servicio = a.id_servicio LIMIT 1) as consultorio_nombre
      FROM "Atencion" a
      JOIN "Pacientes" p ON a.id_paciente = p.id_paciente
      JOIN "Servicio" s ON a.id_servicio = s.id_servicio
      JOIN "Estado" e ON a.id_estado_actual = e.id_estado
      WHERE e.nombre_estado IN ('Llamado', 'En Atención')
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
    // Esta consulta ahora trae tanto las admisiones reales como los pacientes registrados hoy
    // que aún no tienen una atención asignada (usando LEFT JOIN y COALESCE)
    const result = await pool.query(`
      SELECT 
        p.nombre, 
        p.apellido, 
        p.cedula, 
        p.telefono, 
        p.notificaciones_sms as mensaje,
        COALESCE(s.nombre_servicio, 'SIN ASIGNAR') as nombre_servicio, 
        COALESCE(a.hora_llegada, p.fecha_creacion) as fecha_creacion, 
        COALESCE(rp.nombre, 'PENDIENTE') as modalidad_pago,
        a.id_atencion
      FROM "Pacientes" p
      LEFT JOIN "Atencion" a ON p.id_paciente = a.id_paciente
      LEFT JOIN "Servicio" s ON a.id_servicio = s.id_servicio
      LEFT JOIN "Responsable_Pago" rp ON a.id_responsable = rp.id_responsable
      WHERE p.id_sede = $1
      ORDER BY 6 DESC
      LIMIT 15
    `, [req.usuario.id_sede]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error ultimas admisiones:', error);
    res.status(500).json({ mensaje: 'Error al obtener historial' });
  }
};

module.exports = {
  buscarPaciente,
  crearPaciente,
  getResponsablesPago,
  registrarAtencion,
  getTurnosSalaEspera,
  getUltimasAdmisiones
};
