const pool = require('../config/db');

const obtenerMiEstado = async (req, res) => {
  if (!req.usuario) {
    return res.status(401).json({ mensaje: 'No hay usuario autenticado' });
  }
  
  const consultorioId = req.usuario.consultorio_id;
  let servicioId = req.usuario.servicio_id;
  const rol = req.usuario.rol;

  try {
    // Lab/Imagenes: siempre por servicio, ignorar consultorio
    if (rol === 'laboratorio' || rol === 'imagenes') {
      servicioId = await resolverServicioId(rol, servicioId);
      if (!servicioId) {
        const nombreServicio = rol === 'laboratorio' ? 'Laboratorio' : 'Imágenes';
        return res.json({
          estado: 'LIBRE', servicio_id: null, nombre: nombreServicio, servicio_nombre: nombreServicio,
          turno_id: null, turno_numero: null, turno_estado: null,
          nombre_paciente: null, apellido_paciente: null, documento_paciente: null, turno_hora_llegada: null
        });
      }
      const result = await pool.query(`
        SELECT 'LIBRE' as estado, s.id_servicio as servicio_id, s.nombre_servicio as nombre, s.nombre_servicio as servicio_nombre,
          a.id_atencion as turno_id, a.numero as turno_numero,
          CASE WHEN e.nombre_estado = 'En Atención' THEN 'EN_ATENCION' WHEN e.nombre_estado = 'Llamado' THEN 'LLAMADO' ELSE UPPER(e.nombre_estado) END as turno_estado,
          p.nombre as nombre_paciente, p.apellido as apellido_paciente, p.cedula as documento_paciente, a.hora_llegada as turno_hora_llegada,
          (SELECT h.fecha_hora FROM "Historial_Atencion" h WHERE h.id_atencion = a.id_atencion AND h.id_estado = 7 ORDER BY h.fecha_hora DESC LIMIT 1) as hora_llamado
        FROM "Servicio" s
        LEFT JOIN "Atencion" a ON a.id_servicio = s.id_servicio AND a.id_estado_actual IN (4, 7)
        LEFT JOIN "Estado" e ON a.id_estado_actual = e.id_estado
        LEFT JOIN "Pacientes" p ON a.id_paciente = p.id_paciente
        WHERE s.id_servicio = $1 ORDER BY a.id_atencion DESC LIMIT 1
      `, [servicioId]);
      return res.json(result.rows[0] || { estado: 'LIBRE', servicio_id: servicioId, nombre: rol === 'laboratorio' ? 'Laboratorio' : 'Imágenes', servicio_nombre: rol === 'laboratorio' ? 'Laboratorio' : 'Imágenes', turno_id: null, turno_numero: null, turno_estado: null, nombre_paciente: null, apellido_paciente: null, documento_paciente: null, turno_hora_llegada: null });
    }

    // Otros roles: requieren consultorio
    if (!consultorioId) {
      return res.status(400).json({ mensaje: 'No tiene consultorio asignado' });
    }

    const result = await pool.query(`
      SELECT c.estado_fisico as estado, c.id_servicio as servicio_id, c.nombre, s.nombre_servicio as servicio_nombre,
        a.id_atencion as turno_id, a.numero as turno_numero,
        CASE WHEN e.nombre_estado = 'En Atención' THEN 'EN_ATENCION' WHEN e.nombre_estado = 'Llamado' THEN 'LLAMADO' ELSE UPPER(e.nombre_estado) END as turno_estado,
        p.nombre as nombre_paciente, p.apellido as apellido_paciente, p.cedula as documento_paciente, a.hora_llegada as turno_hora_llegada,
        (SELECT h.fecha_hora FROM "Historial_Atencion" h WHERE h.id_atencion = a.id_atencion AND h.id_estado = 7 ORDER BY h.fecha_hora DESC LIMIT 1) as hora_llamado
      FROM "Consultorios" c
      LEFT JOIN "Servicio" s ON c.id_servicio = s.id_servicio
      LEFT JOIN "Atencion" a ON a.id_consultorio = c.id_consultorio AND a.id_estado_actual IN (4, 7)
      LEFT JOIN "Estado" e ON a.id_estado_actual = e.id_estado
      LEFT JOIN "Pacientes" p ON a.id_paciente = p.id_paciente
      WHERE c.id_consultorio = $1 ORDER BY a.id_atencion DESC LIMIT 1
    `, [consultorioId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ mensaje: 'Información no encontrada' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error en obtenerMiEstado:', error);
    res.status(500).json({ mensaje: 'Error al obtener estado' });
  }
};

const resolverServicioId = async (rol, servicioId) => {
  if (servicioId) return servicioId;
  const nombreBuscar = rol === 'laboratorio' ? '%laboratorio%' : '%imagen%';
  const res = await pool.query('SELECT id_servicio FROM "Servicio" WHERE LOWER(nombre_servicio) LIKE LOWER($1) LIMIT 1', [nombreBuscar]);
  return res.rows.length > 0 ? res.rows[0].id_servicio : null;
};

const llamarSiguiente = async (req, res) => {
  console.log('[LLAMAR SIGUIENTE] Usuario:', req.usuario);
  const consultorioId = req.usuario.consultorio_id;
  let servicioId = req.usuario.servicio_id;
  const rol = req.usuario.rol;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    
    let servicioNombre = '';

    // Lab/Imagenes: siempre por servicio, ignorar consultorio
    if (rol === 'laboratorio' || rol === 'imagenes') {
      const sid = await resolverServicioId(rol, servicioId);
      if (!sid) { await client.query('ROLLBACK'); return res.status(400).json({ mensaje: 'Servicio no encontrado' }); }
      servicioId = sid;
      const servicioRes = await client.query('SELECT nombre_servicio FROM "Servicio" WHERE id_servicio = $1', [sid]);
      servicioNombre = servicioRes.rows[0]?.nombre_servicio || (rol === 'laboratorio' ? 'Laboratorio' : 'Imágenes');
    } else {
      // Otros roles: requieren consultorio
      if (!consultorioId) { await client.query('ROLLBACK'); return res.status(400).json({ mensaje: 'Usuario sin consultorio' }); }
      const consultorioRes = await client.query('SELECT estado_fisico as estado, id_servicio as servicio_id, nombre FROM "Consultorios" WHERE id_consultorio = $1 FOR UPDATE', [consultorioId]);
      if (consultorioRes.rows.length === 0) throw new Error('Consultorio no encontrado');
      if (consultorioRes.rows[0].estado !== 'LIBRE') { await client.query('ROLLBACK'); return res.status(400).json({ mensaje: 'El consultorio debe estar LIBRE para llamar' }); }
      servicioId = consultorioRes.rows[0].servicio_id;
      servicioNombre = consultorioRes.rows[0].nombre;
    }

    if (!req.usuario || !req.usuario.id_sede) {
      await client.query('ROLLBACK');
      return res.status(400).json({ mensaje: 'Datos de usuario insuficientes' });
    }
    
    // Buscar paciente en espera (estado_actual = 3 - Sala de Espera)
    const idEspecialidad = req.usuario.id_especialidad;
    let queryEspera = `
      SELECT a.id_atencion as id, a.numero, e.nombre_estado as estado, p.nombre as nombre_paciente, p.apellido as apellido_paciente, p.cedula as documento_paciente, p.telefono as telefono_paciente, a.hora_llegada
      FROM "Atencion" a
      JOIN "Pacientes" p ON a.id_paciente = p.id_paciente
      JOIN "Estado" e ON a.id_estado_actual = e.id_estado
      WHERE a.id_servicio = $1 AND a.id_estado_actual = 3 AND a.id_sede = $2
    `;
    const paramsEspera = [servicioId, req.usuario.id_sede];

    if (idEspecialidad) {
      queryEspera += ` AND a.id_especialidad = $3`;
      paramsEspera.push(idEspecialidad);
    }

    queryEspera += ` ORDER BY a.hora_llegada ASC LIMIT 1 FOR UPDATE SKIP LOCKED`;

    const turnoRes = await client.query(queryEspera, paramsEspera);

    if (turnoRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.json({ mensaje: 'No hay pacientes en espera de este servicio', turno: null });
    }

    const turno = turnoRes.rows[0];

    // Actualizar Atencion (estado 7 = Llamado)
    await client.query(
      "UPDATE \"Atencion\" SET id_estado_actual = 7, id_consultorio = $1 WHERE id_atencion = $2",
      [rol === 'laboratorio' || rol === 'imagenes' ? null : consultorioId, turno.id]
    );

    await client.query(
      "INSERT INTO \"Historial_Atencion\" (id_atencion, id_estado) VALUES ($1, 7)", [turno.id]
    );

    if (consultorioId && rol !== 'laboratorio' && rol !== 'imagenes') {
      await client.query("UPDATE \"Consultorios\" SET estado_fisico = 'OCUPADO' WHERE id_consultorio = $1", [consultorioId]);
    }

    await client.query('COMMIT');

    if (req.io) {
      req.io.emit('estado-actualizado', { tipo: 'llamado', id_atencion: turno.id });
      req.io.emit('nuevo-llamado', { 
        turno: turno.numero, 
        consultorio: servicioNombre,
        paciente: turno.nombre_paciente,
        id_sede: req.usuario.id_sede
      });
    }

    res.json({
      mensaje: 'Paciente llamado exitosamente',
      turno: {
        id: turno.id,
        numero: turno.numero,
        estado: 'LLAMADO',
        hora_llegada: turno.hora_llegada,
        paciente: {
          nombre: turno.nombre_paciente,
          apellido: turno.apellido_paciente,
          documento: turno.documento_paciente,
          telefono: turno.telefono_paciente
        }
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en llamarSiguiente:', error);
    res.status(500).json({ mensaje: error.message || 'Error al procesar el llamado' });
  } finally {
    client.release();
  }
};

const iniciarAtencion = async (req, res) => {
  const consultorioId = req.usuario.consultorio_id;
  let servicioId = req.usuario.servicio_id;
  const rol = req.usuario.rol;
  const client = await pool.connect();
  
  try {
    // Lab/Imagenes: resolver servicio, ignorar consultorio
    if (rol === 'laboratorio' || rol === 'imagenes') {
      servicioId = await resolverServicioId(rol, servicioId);
      if (!servicioId) { await client.query('ROLLBACK'); return res.status(400).json({ mensaje: 'Servicio no encontrado' }); }
    } else if (!consultorioId) {
      return res.status(400).json({ mensaje: 'Usuario sin consultorio' });
    }

    await client.query('BEGIN');
    
    let query, params;
    
    if (rol === 'laboratorio' || rol === 'imagenes') {
      query = 'SELECT id_atencion FROM "Atencion" WHERE id_servicio = $1 AND id_estado_actual = 7 LIMIT 1 FOR UPDATE';
      params = [servicioId];
    } else {
      query = 'SELECT id_atencion FROM "Atencion" WHERE id_consultorio = $1 AND id_estado_actual = 7 LIMIT 1 FOR UPDATE';
      params = [consultorioId];
    }

    const atencionRes = await client.query(query, params);
    
    if (atencionRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ mensaje: 'No hay paciente llamado esperando para iniciar atención' });
    }
    
    const atencionId = atencionRes.rows[0].id_atencion;
    
    await client.query('UPDATE "Atencion" SET id_estado_actual = 4 WHERE id_atencion = $1', [atencionId]);
    await client.query("INSERT INTO \"Historial_Atencion\" (id_atencion, id_estado) VALUES ($1, 4)", [atencionId]);
    await client.query('COMMIT');

    if (req.io) req.io.emit('estado-actualizado', { id_atencion: atencionId });

    res.json({ mensaje: 'Atención iniciada correctamente', id_atencion: atencionId });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en iniciarAtencion:', error);
    res.status(500).json({ mensaje: 'Error al iniciar atención: ' + error.message });
  } finally {
    client.release();
  }
};

const finalizarAtencion = async (req, res) => {
  const consultorioId = req.usuario.consultorio_id;
  let servicioId = req.usuario.servicio_id;
  const rol = req.usuario.rol;
  const client = await pool.connect();
  
  try {
    // Lab/Imagenes: resolver servicio, ignorar consultorio
    if (rol === 'laboratorio' || rol === 'imagenes') {
      servicioId = await resolverServicioId(rol, servicioId);
      if (!servicioId) { await client.query('ROLLBACK'); return res.status(400).json({ mensaje: 'Servicio no encontrado' }); }
    } else if (!consultorioId) {
      return res.status(400).json({ mensaje: 'Usuario sin consultorio' });
    }

    await client.query('BEGIN');
    
    let query, params;
    
    if (rol === 'laboratorio' || rol === 'imagenes') {
      query = 'UPDATE "Atencion" SET id_estado_actual = 5, hora_salida = NOW() WHERE id_servicio = $1 AND id_estado_actual = 4 RETURNING id_atencion';
      params = [servicioId];
    } else {
      query = 'UPDATE "Atencion" SET id_estado_actual = 5, hora_salida = NOW() WHERE id_consultorio = $1 AND id_estado_actual = 4 RETURNING id_atencion';
      params = [consultorioId];
    }

    const turnoRes = await client.query(query, params);
    
    if (turnoRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(200).json({ mensaje: 'No hay pacientes en espera de este servicio', turno: null });
    }

    const atencionId = turnoRes.rows[0].id_atencion;
    await client.query("INSERT INTO \"Historial_Atencion\" (id_atencion, id_estado) VALUES ($1, 5)", [atencionId]);

    if (consultorioId && rol !== 'laboratorio' && rol !== 'imagenes') {
      await client.query("UPDATE \"Consultorios\" SET estado_fisico = 'LIBRE' WHERE id_consultorio = $1", [consultorioId]);
    }

    await client.query('COMMIT');

    if (req.io) req.io.emit('estado-actualizado', { id_atencion: atencionId });

    res.json({ mensaje: 'Atención finalizada' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en finalizarAtencion:', error);
    res.status(500).json({ mensaje: 'Error al finalizar atención: ' + error.message });
  } finally {
    client.release();
  }
};

module.exports = {
  obtenerMiEstado,
  llamarSiguiente,
  iniciarAtencion,
  finalizarAtencion,
};
