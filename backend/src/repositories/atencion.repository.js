const pool = require('../config/db');

const getUltimasAdmisiones = async (sede) => {
  const result = await pool.query(
    `SELECT
      a.id_atencion, a.numero,
      a.hora_llegada as fecha_creacion,
      a.hora_salida,
      a.id_estado_actual, a.id_servicio, a.id_paciente, a.id_especialidad, a.id_cliente,
      a.id_medico, a.id_consultorio,
      p.id_paciente, p.cedula, p.nombre, p.apellido, p.telefono,
      s.nombre_servicio, s.prefijo,
      e.nombre_estado,
      rp.nombre as modalidad_pago,
      a.id_responsable,
      esp.nombre as nombre_especialidad,
      u.nombre || ' ' || u.apellido as nombre_medico
    FROM "Atencion" a
    JOIN "Pacientes" p ON a.id_paciente = p.id_paciente
    JOIN "Servicio" s ON a.id_servicio = s.id_servicio
    JOIN "Estado" e ON a.id_estado_actual = e.id_estado
    LEFT JOIN "Responsable_Pago" rp ON a.id_responsable = rp.id_responsable
    LEFT JOIN "Especialidades" esp ON a.id_especialidad = esp.id_especialidad
    LEFT JOIN "Usuarios" u ON a.id_medico = u.id_usuario
    WHERE a.id_sede = $1 AND a.hora_llegada::date = CURRENT_DATE
    ORDER BY a.hora_llegada DESC
    LIMIT 50`,
    [sede],
  );
  return result.rows;
};

const getAtencionEstado = async (id, sede) => {
  const result = await pool.query(
    `SELECT id_estado_actual, id_responsable, id_servicio, id_especialidad, id_medico FROM "Atencion" WHERE id_atencion = $1 AND id_sede = $2`,
    [id, sede],
  );
  return result.rows[0] || null;
};

const actualizarAtencionConServicio = async (id, sede, data) => {
  await pool.query(
    `UPDATE "Atencion"
     SET id_servicio = $1,
         id_responsable = COALESCE($2, id_responsable),
         id_cliente = COALESCE($3, id_cliente),
         id_especialidad = $6,
         id_medico = $7,
         id_consultorio = $8
     WHERE id_atencion = $4 AND id_sede = $5`,
    [data.id_servicio, data.id_responsable || null, data.id_cliente || null, id, sede, data.id_especialidad || null, data.id_medico || null, data.id_consultorio || null],
  );
};

const actualizarAtencionSimple = async (id, sede, data) => {
  await pool.query(
    `UPDATE "Atencion"
     SET id_responsable = COALESCE($1, id_responsable),
         id_cliente = COALESCE($2, id_cliente),
         id_especialidad = COALESCE($3, id_especialidad)
     WHERE id_atencion = $4 AND id_sede = $5`,
    [data.id_responsable || null, data.id_cliente || null, data.id_especialidad || null, id, sede],
  );
};

const eliminarAtencion = async (client, id, sede) => {
  await client.query('DELETE FROM "Atencion" WHERE id_atencion = $1 AND id_sede = $2', [id, sede]);
};

const actualizarEstadoAtencion = async (id, sede, idEstadoNuevo) => {
  const result = await pool.query(
    `UPDATE "Atencion"
     SET id_estado_actual = $1
     WHERE id_atencion = $2 AND id_sede = $3
     RETURNING id_atencion, id_estado_actual`,
    [idEstadoNuevo, id, sede],
  );
  return result.rows[0] || null;
};

const getPrefijoYConteo = async (idServicio, sede) => {
  const prefijoResult = await pool.query(
    `SELECT prefijo FROM "Servicio" WHERE id_servicio = $1`,
    [idServicio],
  );
  const prefijo = prefijoResult.rows[0]?.prefijo || 'T';

  const countResult = await pool.query(
    `SELECT COUNT(*) + 1 as next FROM "Atencion"
     WHERE id_servicio = $1 AND hora_llegada >= CURRENT_DATE AND id_sede = $2`,
    [idServicio, sede],
  );
  return { prefijo, next: countResult.rows[0].next };
};

const insertarAtencion = async (data) => {
  const result = await pool.query(
    `INSERT INTO "Atencion" (id_paciente, id_servicio, id_responsable, id_estado_actual, id_sede, id_usuario_registro, numero, id_cliente, id_especialidad, id_medico, id_consultorio)
     VALUES ($1, $2, $3, 1, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id_atencion, numero, hora_llegada`,
    [data.id_paciente, data.id_servicio, data.id_responsable || null, data.sede, data.usuarioId || null, data.numero, data.id_cliente || null, data.id_especialidad || null, data.id_medico || null, data.id_consultorio || null],
  );
  return result.rows[0];
};

const getTodosLosTurnos = async (sede) => {
  const result = await pool.query(`
    SELECT
      a.id_atencion as id,
      a.numero,
      p.nombre as paciente_nombre,
      p.apellido as paciente_apellido,
      p.cedula as paciente_documento,
      s.nombre_servicio,
      e.nombre_estado as estado,
      a.id_especialidad,
      a.id_consultorio,
      a.id_servicio,
      a.id_sede,
      a.id_estado_actual,
      a.hora_llegada
    FROM "Atencion" a
    JOIN "Pacientes" p ON a.id_paciente = p.id_paciente
    JOIN "Servicio" s ON a.id_servicio = s.id_servicio
    JOIN "Estado" e ON a.id_estado_actual = e.id_estado
    WHERE a.id_sede = $1 AND a.hora_llegada >= CURRENT_DATE
    ORDER BY a.hora_llegada DESC
  `, [sede]);
  return result.rows;
};

const getConteoServicioHoy = async (idServicio) => {
  const result = await pool.query(
    'SELECT COUNT(*) + 1 as next FROM "Atencion" WHERE id_servicio = $1 AND hora_llegada >= CURRENT_DATE',
    [idServicio],
  );
  return result.rows[0].next;
};

const getServicioPrefijo = async (idServicio) => {
  const result = await pool.query('SELECT prefijo FROM "Servicio" WHERE id_servicio = $1', [idServicio]);
  return result.rows[0]?.prefijo || 'T';
};

const insertarTurno = async (data) => {
  const result = await pool.query(
    'INSERT INTO "Atencion" (id_paciente, id_servicio, id_especialidad, id_responsable, id_estado_actual, id_sede, numero) VALUES ($1, $2, $3, $4, 1, $5, $6) RETURNING *',
    [data.id_paciente, data.id_servicio, data.id_especialidad, data.id_responsable, data.id_sede, data.numero],
  );
  return result.rows[0];
};

const marcarAusente = async (client, id) => {
  const result = await client.query(
    'UPDATE "Atencion" SET id_estado_actual = 7, hora_salida = NOW() WHERE id_atencion = $1 RETURNING id_consultorio',
    [id],
  );
  return result.rows[0] || null;
};

const finalizarAtencionTransferencia = async (client, id) => {
  const result = await client.query(
    'UPDATE "Atencion" SET id_estado_actual = 6, hora_salida = NOW() WHERE id_atencion = $1 RETURNING *',
    [id],
  );
  return result.rows[0] || null;
};

const reincorporarPaciente = async (client, id) => {
  const result = await client.query(
    'UPDATE "Atencion" SET id_estado_actual = 3, hora_salida = NULL, hora_llegada = NOW() WHERE id_atencion = $1 AND id_estado_actual = 7 RETURNING *',
    [id],
  );
  return result.rows[0] || null;
};

const getEnEsperaPorServicio = async (client, servicioId, sede, idEspecialidad) => {
  let query = `
    SELECT a.id_atencion as id, a.numero, e.nombre_estado as estado, p.nombre as nombre_paciente, p.apellido as apellido_paciente, p.cedula as documento_paciente, p.telefono as telefono_paciente, a.hora_llegada
    FROM "Atencion" a
    JOIN "Pacientes" p ON a.id_paciente = p.id_paciente
    JOIN "Estado" e ON a.id_estado_actual = e.id_estado
    WHERE a.id_servicio = $1 AND a.id_estado_actual = 3 AND a.id_sede = $2
  `;
  const params = [servicioId, sede];
  if (idEspecialidad) {
    query += ` AND a.id_especialidad = $3`;
    params.push(idEspecialidad);
  }
  query += ` ORDER BY a.hora_llegada ASC LIMIT 1 FOR UPDATE SKIP LOCKED`;
  const result = await client.query(query, params);
  return result.rows[0] || null;
};

const llamarAtencion = async (client, id, consultorioId) => {
  await client.query(
    'UPDATE "Atencion" SET id_estado_actual = 4, id_consultorio = $1 WHERE id_atencion = $2',
    [consultorioId, id],
  );
};

const iniciarAtencionPorConsultorio = async (client, consultorioId) => {
  const result = await client.query(
    'SELECT id_atencion FROM "Atencion" WHERE id_consultorio = $1 AND id_estado_actual = 4 LIMIT 1 FOR UPDATE',
    [consultorioId],
  );
  return result.rows[0] || null;
};

const iniciarAtencionPorServicio = async (client, servicioId) => {
  const result = await client.query(
    'SELECT id_atencion FROM "Atencion" WHERE id_servicio = $1 AND id_estado_actual = 4 LIMIT 1 FOR UPDATE',
    [servicioId],
  );
  return result.rows[0] || null;
};

const setAtencionEstado = async (client, id, estado) => {
  await client.query('UPDATE "Atencion" SET id_estado_actual = $1 WHERE id_atencion = $2', [estado, id]);
};

const finalizarPorConsultorio = async (client, consultorioId) => {
  const result = await client.query(
    'UPDATE "Atencion" SET id_estado_actual = 6, hora_salida = NOW() WHERE id_consultorio = $1 AND id_estado_actual = 5 RETURNING id_atencion',
    [consultorioId],
  );
  return result.rows[0] || null;
};

const finalizarPorServicio = async (client, servicioId) => {
  const result = await client.query(
    'UPDATE "Atencion" SET id_estado_actual = 6, hora_salida = NOW() WHERE id_servicio = $1 AND id_estado_actual = 5 RETURNING id_atencion',
    [servicioId],
  );
  return result.rows[0] || null;
};

const liberarEnConsultorio = async (client, consultorioId) => {
  await client.query(
    'UPDATE "Atencion" SET id_estado_actual = 6, hora_salida = NOW() WHERE id_consultorio = $1 AND id_estado_actual IN (4, 5)',
    [consultorioId],
  );
};

const liberarEnServicio = async (client, servicioId) => {
  await client.query(
    'UPDATE "Atencion" SET id_estado_actual = 6, hora_salida = NOW() WHERE id_servicio = $1 AND id_estado_actual IN (4, 5)',
    [servicioId],
  );
};

const getTurnoConConsultorio = async (client, id) => {
  const result = await client.query(
    'UPDATE "Atencion" SET id_estado_actual = 6, hora_salida = NOW() WHERE id_atencion = $1 RETURNING *',
    [id],
  );
  return result.rows[0] || null;
};

const getReporteDiario = async (sede) => {
  const result = await pool.query(
    `SELECT
      a.id_atencion as id,
      a.numero,
      e.nombre_estado as estado,
      a.hora_llegada,
      a.hora_salida as hora_fin,
      p.nombre as paciente_nombre,
      p.apellido as paciente_apellido,
      p.cedula as paciente_documento,
      p.telefono as paciente_telefono,
      s.nombre_servicio as servicio,
      a.id_sede
    FROM "Atencion" a
    JOIN "Pacientes" p ON a.id_paciente = p.id_paciente
    JOIN "Servicio" s ON a.id_servicio = s.id_servicio
    JOIN "Estado" e ON a.id_estado_actual = e.id_estado
    WHERE a.hora_llegada >= CURRENT_DATE
    AND a.hora_llegada < (CURRENT_DATE + interval '1 day')
    AND a.id_sede = $1
    ORDER BY a.hora_llegada DESC`,
    [sede],
  );
  return result.rows;
};

const getEstadoDeAtencionPorServicio = async (servicioId) => {
  const result = await pool.query(`
    SELECT 'LIBRE' as estado, s.id_servicio as servicio_id, s.nombre_servicio as nombre, s.nombre_servicio as servicio_nombre,
      a.id_atencion as turno_id, a.numero as turno_numero,
      CASE WHEN e.nombre_estado = 'En Atencion' THEN 'EN_ATENCION' WHEN e.nombre_estado = 'Llamado' THEN 'LLAMADO' ELSE UPPER(e.nombre_estado) END as turno_estado,
      p.nombre as nombre_paciente, p.apellido as apellido_paciente, p.cedula as documento_paciente, a.hora_llegada as turno_hora_llegada,
      (SELECT h.fecha_hora FROM "Historial_Atencion" h WHERE h.id_atencion = a.id_atencion AND h.id_estado = 4 ORDER BY h.fecha_hora DESC LIMIT 1) as hora_llamado
    FROM "Servicio" s
    LEFT JOIN "Atencion" a ON a.id_servicio = s.id_servicio AND a.id_estado_actual IN (5, 4) AND a.hora_salida IS NULL
    LEFT JOIN "Estado" e ON a.id_estado_actual = e.id_estado
    LEFT JOIN "Pacientes" p ON a.id_paciente = p.id_paciente
    WHERE s.id_servicio = $1 ORDER BY a.id_atencion DESC LIMIT 1
  `, [servicioId]);
  return result.rows[0] || null;
};

const getEstadoDeAtencionPorConsultorio = async (consultorioId) => {
  const result = await pool.query(`
    SELECT c.estado_fisico as estado, c.id_servicio as servicio_id, c.nombre, s.nombre_servicio as servicio_nombre,
      a.id_atencion as turno_id, a.numero as turno_numero,
      CASE WHEN e.nombre_estado = 'En Atencion' THEN 'EN_ATENCION' WHEN e.nombre_estado = 'Llamado' THEN 'LLAMADO' ELSE UPPER(e.nombre_estado) END as turno_estado,
      p.nombre as nombre_paciente, p.apellido as apellido_paciente, p.cedula as documento_paciente, a.hora_llegada as turno_hora_llegada,
      (SELECT h.fecha_hora FROM "Historial_Atencion" h WHERE h.id_atencion = a.id_atencion AND h.id_estado = 4 ORDER BY h.fecha_hora DESC LIMIT 1) as hora_llamado
    FROM "Consultorios" c
    LEFT JOIN "Servicio" s ON c.id_servicio = s.id_servicio
    LEFT JOIN "Atencion" a ON a.id_consultorio = c.id_consultorio AND a.id_estado_actual IN (5, 4) AND a.hora_salida IS NULL
    LEFT JOIN "Estado" e ON a.id_estado_actual = e.id_estado
    LEFT JOIN "Pacientes" p ON a.id_paciente = p.id_paciente
    WHERE c.id_consultorio = $1 ORDER BY a.id_atencion DESC LIMIT 1
  `, [consultorioId]);
  return result.rows[0] || null;
};

const getPacientesEnEspera = async (sede, idServicio, idEspecialidad) => {
  let whereClause = 'WHERE a.id_sede = $1 AND a.hora_salida IS NULL';
  const params = [sede];

  if (idEspecialidad && idEspecialidad !== 'null' && idEspecialidad !== 'undefined') {
    whereClause += ` AND a.id_especialidad = $${params.length + 1}`;
    params.push(idEspecialidad);
  } else if (idServicio && idServicio !== 'null' && idServicio !== 'undefined') {
    whereClause += ` AND a.id_servicio = $${params.length + 1}`;
    params.push(idServicio);
  }

  const result = await pool.query(
    `SELECT
      a.id_atencion, a.hora_llegada, p.nombre, p.apellido, p.cedula, e.nombre_estado, s.nombre_servicio,
      a.id_estado_actual, a.id_especialidad, esp.nombre as nombre_especialidad
    FROM "Atencion" a
    INNER JOIN "Pacientes" p ON a.id_paciente = p.id_paciente
    INNER JOIN "Estado" e ON a.id_estado_actual = e.id_estado
    INNER JOIN "Servicio" s ON a.id_servicio = s.id_servicio
    LEFT JOIN "Especialidades" esp ON a.id_especialidad = esp.id_especialidad
    ${whereClause}
    AND UPPER(e.nombre_estado) IN ('SALA DE ESPERA')
    ORDER BY a.hora_llegada ASC`,
    params,
  );
  return result.rows;
};

const getAtendidosHoy = async (sede, idServicio, idEspecialidad) => {
  let whereClause = 'WHERE a.hora_salida IS NOT NULL AND a.hora_salida::date = CURRENT_DATE AND a.id_sede = $1';
  const params = [sede];

  if (idEspecialidad && idEspecialidad !== 'null' && idEspecialidad !== 'undefined') {
    whereClause += ` AND a.id_especialidad = $${params.length + 1}`;
    params.push(idEspecialidad);
  } else if (idServicio && idServicio !== 'null' && idServicio !== 'undefined') {
    whereClause += ` AND a.id_servicio = $${params.length + 1}`;
    params.push(idServicio);
  }

  const result = await pool.query(
    `SELECT
      a.id_atencion, a.hora_llegada, a.hora_salida, p.nombre, p.apellido, p.cedula, e.nombre_estado, s.nombre_servicio,
      a.id_estado_actual, a.id_especialidad, esp.nombre as nombre_especialidad
    FROM "Atencion" a
    INNER JOIN "Pacientes" p ON a.id_paciente = p.id_paciente
    INNER JOIN "Estado" e ON a.id_estado_actual = e.id_estado
    INNER JOIN "Servicio" s ON a.id_servicio = s.id_servicio
    LEFT JOIN "Especialidades" esp ON a.id_especialidad = esp.id_especialidad
    ${whereClause}
    ORDER BY a.hora_salida DESC
    LIMIT 20`,
    params,
  );
  return result.rows;
};

const getTurneroPacientes = async (estados, servicios, responsable) => {
  const condiciones = [`a.hora_llegada >= CURRENT_DATE`];
  const params = [];
  let paramIndex = 1;

  if (estados) {
    const ids = estados.split(',').map(Number).filter(n => !isNaN(n));
    if (ids.length > 0) {
      const placeholders = ids.map((id) => {
        params.push(id);
        return `$${paramIndex++}`;
      });
      condiciones.push(`a.id_estado_actual IN (${placeholders.join(',')})`);
    }
  }

  if (servicios) {
    const ids = servicios.split(',').map(Number).filter(n => !isNaN(n));
    if (ids.length > 0) {
      const placeholders = ids.map((id) => {
        params.push(id);
        return `$${paramIndex++}`;
      });
      condiciones.push(`a.id_servicio IN (${placeholders.join(',')})`);
    }
  }

  if (responsable) {
    const ids = responsable.split(',').map(Number).filter(n => !isNaN(n));
    if (ids.length > 0) {
      const placeholders = ids.map((id) => {
        params.push(id);
        return `$${paramIndex++}`;
      });
      condiciones.push(`a.id_responsable IN (${placeholders.join(',')})`);
    }
  }

  const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

  const result = await pool.query(
    `SELECT DISTINCT ON (a.id_atencion)
      a.id_atencion, a.numero, a.hora_llegada, a.hora_salida, a.id_estado_actual, a.id_responsable,
      p.nombre, p.apellido, p.cedula,
      s.nombre_servicio, s.prefijo, s.id_servicio,
      e.nombre_estado,
      c.nombre as consultorio_nombre,
      rp.nombre as modalidad_pago,
      esp.nombre as nombre_especialidad
    FROM "Atencion" a
    JOIN "Pacientes" p ON a.id_paciente = p.id_paciente
    JOIN "Servicio" s ON a.id_servicio = s.id_servicio
    JOIN "Estado" e ON a.id_estado_actual = e.id_estado
    LEFT JOIN "Consultorios" c ON a.id_consultorio = c.id_consultorio
    LEFT JOIN "Historial_Atencion" h ON a.id_atencion = h.id_atencion
    LEFT JOIN "Responsable_Pago" rp ON a.id_responsable = rp.id_responsable
    LEFT JOIN "Especialidades" esp ON a.id_especialidad = esp.id_especialidad
    ${where}
    ORDER BY a.id_atencion, h.fecha_hora DESC NULLS LAST
    LIMIT 50`,
    params,
  );
  return result.rows;
};

const getSalaEspera = async () => {
  const result = await pool.query(
    `SELECT DISTINCT ON (a.id_atencion)
      a.id_atencion, a.numero, a.hora_llegada, a.hora_salida, a.id_estado_actual,
      p.nombre, p.apellido, p.cedula,
      s.nombre_servicio, s.prefijo, s.id_servicio,
      e.nombre_estado,
      c.nombre as consultorio_nombre,
      esp.nombre as nombre_especialidad
    FROM "Atencion" a
    JOIN "Pacientes" p ON a.id_paciente = p.id_paciente
    JOIN "Servicio" s ON a.id_servicio = s.id_servicio
    JOIN "Estado" e ON a.id_estado_actual = e.id_estado
    LEFT JOIN "Consultorios" c ON a.id_consultorio = c.id_consultorio
    LEFT JOIN "Especialidades" esp ON a.id_especialidad = esp.id_especialidad
    LEFT JOIN "Historial_Atencion" h ON a.id_atencion = h.id_atencion
    WHERE a.hora_llegada >= CURRENT_DATE
      AND a.id_estado_actual = 4
    ORDER BY a.id_atencion, h.fecha_hora DESC NULLS LAST
    LIMIT 20`,
  );
  return result.rows;
};

module.exports = {
  getUltimasAdmisiones,
  getAtencionEstado,
  actualizarAtencionConServicio,
  actualizarAtencionSimple,
  eliminarAtencion,
  actualizarEstadoAtencion,
  getPrefijoYConteo,
  insertarAtencion,
  getTodosLosTurnos,
  getConteoServicioHoy,
  getServicioPrefijo,
  insertarTurno,
  marcarAusente,
  finalizarAtencionTransferencia,
  reincorporarPaciente,
  getEnEsperaPorServicio,
  llamarAtencion,
  iniciarAtencionPorConsultorio,
  iniciarAtencionPorServicio,
  setAtencionEstado,
  finalizarPorConsultorio,
  finalizarPorServicio,
  liberarEnConsultorio,
  liberarEnServicio,
  getTurnoConConsultorio,
  getReporteDiario,
  getEstadoDeAtencionPorServicio,
  getEstadoDeAtencionPorConsultorio,
  getPacientesEnEspera,
  getAtendidosHoy,
  getTurneroPacientes,
  getSalaEspera,
};
