/**
 * Repositorio de atenciones/turnos (tabla "Atencion") — el corazón del sistema.
 *
 * Cada fila de "Atencion" es un turno: un paciente + servicio + número +
 * estado actual. Los cambios de estado se registran además en
 * "Historial_Atencion" (ver historial.repository.js).
 *
 * MÁQUINA DE ESTADOS (tabla "Estado", backend/db/init.sql):
 *   1 Registrado       -> al crear el turno (insertarAtencion/insertarTurno)
 *   2 En Caja          -> paciente en caja (pago)
 *   3 Sala de Espera   -> esperando ser llamado (en la cola)
 *   4 Llamado          -> llamado por el turnero a un consultorio
 *   5 En Atencion      -> el médico inició la consulta
 *   6 Atendido         -> finalizado (hora_salida se llena aquí)
 *   7 Ausente          -> marcado como ausente (o limpieza diaria)
 *   8 Espera de clave  -> esperando autorización de aseguradora (APS)
 *   9 Retirado         -> se retiró voluntariamente
 *
 * PATRÓN DE TRANSACCIONES: las funciones que reciben `client` se ejecutan
 * dentro de una transacción iniciada por el controlador (BEGIN/COMMIT/ROLLBACK),
 * y usan 'SELECT ... FOR UPDATE' para bloquear filas y evitar carreras
 * (p. ej. que dos médicos llamen al mismo paciente). Si no reciben `client`,
 * usan el pool global.
 */
const pool = require('../config/db');

/**
 * Lista las últimas 50 admisiones de hoy (día actual), con datos completos
 * del paciente, servicio, especialidad, médico y modalidad de pago.
 *
 * @param {number} sede - ID de la sede
 * @returns {Promise<Array<object>>}
 */
const getUltimasAdmisiones = async (sede) => {
  const result = await pool.query(
    `SELECT
      a.id_atencion, a.numero,
      a.hora_llegada as fecha_creacion,
      a.hora_salida,
      a.id_estado_actual, a.id_servicio, a.id_paciente, a.id_especialidad, a.id_cliente,
      a.id_medico, a.id_consultorio,
      p.id_paciente, p.cedula, p.primer_nombre as nombre, p.segundo_nombre, p.primer_apellido as apellido, p.segundo_apellido, p.fecha_nacimiento, p.telefono,
      s.nombre_servicio, s.prefijo,
      e.nombre_estado,
      rp.nombre as modalidad_pago,
      a.id_responsable,
      esp.nombre as nombre_especialidad,
      u.primer_nombre || ' ' || u.primer_apellido as nombre_medico
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

/**
 * Obtiene una atención con todos sus datos relacionados por ID.
 *
 * @param {number} id - ID de la atención
 * @param {number} sede - ID de la sede (filtro de aislamiento)
 * @returns {Promise<object|null>}
 */
const getAdmisionById = async (id, sede) => {
  const result = await pool.query(
    `SELECT
      a.id_atencion, a.numero,
      a.hora_llegada as fecha_creacion,
      a.hora_salida,
      a.id_estado_actual, a.id_servicio, a.id_paciente, a.id_especialidad, a.id_cliente,
      a.id_medico, a.id_consultorio,
      p.id_paciente, p.cedula, p.primer_nombre as nombre, p.segundo_nombre, p.primer_apellido as apellido, p.segundo_apellido, p.fecha_nacimiento, p.telefono,
      s.nombre_servicio, s.prefijo,
      e.nombre_estado,
      rp.nombre as modalidad_pago,
      a.id_responsable,
      esp.nombre as nombre_especialidad,
      u.primer_nombre || ' ' || u.primer_apellido as nombre_medico
    FROM "Atencion" a
    JOIN "Pacientes" p ON a.id_paciente = p.id_paciente
    JOIN "Servicio" s ON a.id_servicio = s.id_servicio
    JOIN "Estado" e ON a.id_estado_actual = e.id_estado
    LEFT JOIN "Responsable_Pago" rp ON a.id_responsable = rp.id_responsable
    LEFT JOIN "Especialidades" esp ON a.id_especialidad = esp.id_especialidad
    LEFT JOIN "Usuarios" u ON a.id_medico = u.id_usuario
    WHERE a.id_atencion = $1 AND a.id_sede = $2`,
    [id, sede],
  );
  return result.rows[0] || null;
};

const getAtencionEstado = async (id, sede) => {
  const result = await pool.query(
    `SELECT id_estado_actual, id_responsable, id_servicio, id_especialidad, id_medico FROM "Atencion" WHERE id_atencion = $1 AND id_sede = $2`,
    [id, sede],
  );
  return result.rows[0] || null;
};

/**
 * Lista los turnos que tiene un paciente (para saber si ya fue atendido hoy
 * o si tiene turnos activos antes de registrar uno nuevo).
 */
const getAtencionesDePaciente = async (idPaciente, sede) => {
  const result = await pool.query(
    `SELECT id_atencion, id_estado_actual FROM "Atencion" WHERE id_paciente = $1 AND id_sede = $2`,
    [idPaciente, sede],
  );
  return result.rows;
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

const eliminarAtencionesDePaciente = async (client, idPaciente, sede) => {
  await client.query('DELETE FROM "Atencion" WHERE id_paciente = $1 AND id_sede = $2', [idPaciente, sede]);
};

const actualizarEstadoAtencion = async (id, sede, idEstadoNuevo) => {
  // Idempotente: solo hace match si el estado realmente cambia, así un doble
  // envío no inserta un historial duplicado.
  const result = await pool.query(
    `UPDATE "Atencion"
     SET id_estado_actual = $1
     WHERE id_atencion = $2 AND id_sede = $3 AND id_estado_actual <> $1
     RETURNING id_atencion, id_estado_actual`,
    [idEstadoNuevo, id, sede],
  );
  return result.rows[0] || null;
};

/**
 * Crea una atención desde admisión/recepción. El estado inicial es 1 (Registrado).
 *
 * @param {object} data - Datos del turno (id_paciente, id_servicio, id_responsable, sede, numero, ...)
 * @param {object} [client] - Cliente de transacción opcional
 * @returns {Promise<object>} Atención creada (id_atencion, numero, hora_llegada)
 */
const insertarAtencion = async (data, client = null) => {
  const db = client || pool;
  const result = await db.query(
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
      p.primer_nombre as paciente_nombre,
      p.primer_apellido as paciente_apellido,
      p.cedula as paciente_documento,
      s.nombre_servicio,
      e.nombre_estado as estado,
      a.id_especialidad,
      a.id_consultorio,
      a.id_servicio,
      a.id_sede,
      a.id_estado_actual,
      a.hora_llegada,
      a.hora_salida
    FROM "Atencion" a
    JOIN "Pacientes" p ON a.id_paciente = p.id_paciente
    JOIN "Servicio" s ON a.id_servicio = s.id_servicio
    JOIN "Estado" e ON a.id_estado_actual = e.id_estado
    WHERE a.id_sede = $1 AND a.hora_llegada >= CURRENT_DATE
    ORDER BY a.hora_llegada DESC
  `, [sede]);
  return result.rows;
};

const getSiguienteNumero = async (client, idServicio, sede) => {
  // La unicidad del número se garantiza a nivel de aplicación con este upsert
  // atómico: el bloqueo de fila de la PK (sede + servicio + fecha) serializa
  // las transacciones concurrentes, por lo que cada turno recibe un número
  // distinto y creciente aunque se registren varios a la vez.
  const result = await client.query(
    `INSERT INTO "Secuencia_Turnos" ("id_sede", "id_servicio", "fecha", "ultimo")
     VALUES ($1, $2, CURRENT_DATE, 1)
     ON CONFLICT ("id_sede", "id_servicio", "fecha")
     DO UPDATE SET ultimo = "Secuencia_Turnos".ultimo + 1
     RETURNING ultimo`,
    [sede, idServicio],
  );
  const ultimo = Number(result.rows[0].ultimo);

  // RECICLAJE: si durante el día se eliminó alguna atención (p. ej. un turno
  // en estado Registrado), su número quedó libre. Se devuelve el menor número
  // libre del día en [1..ultimo] (que será "ultimo" si no hay huecos). El
  // contador NO se decrementa, para no volver a emitir números que ya están
  // en uso (el bug del método anterior con COUNT + recontar). La consulta
  // corre dentro de la transacción que ya tiene el bloqueo de la fila de la
  // secuencia, así que el conjunto de números usados es estable y no se puede
  // entregar dos veces el mismo número.
  const usados = await client.query(
    `SELECT NULLIF(regexp_replace(a.numero, '[^0-9]', '', 'g'), '')::int AS n
     FROM "Atencion" a
     WHERE a.id_sede = $1 AND a.id_servicio = $2
       AND a.hora_llegada >= CURRENT_DATE
       AND a.numero ~ '[0-9]'`,
    [sede, idServicio],
  );
  const enUso = new Set(usados.rows.map((r) => r.n).filter((n) => Number.isInteger(n)));
  for (let n = 1; n <= ultimo; n++) {
    if (!enUso.has(n)) return n;
  }
  return ultimo;
};

const getServicioPrefijo = async (idServicio) => {
  const result = await pool.query('SELECT prefijo FROM "Servicio" WHERE id_servicio = $1', [idServicio]);
  return result.rows[0]?.prefijo || 'T';
};

/**
 * Crea un turno (variante del turnero, con especialidad y responsable).
 * El estado inicial también es 1 (Registrado).
 *
 * @param {object} data - Datos del turno
 * @param {object} [client] - Cliente de transacción opcional
 * @returns {Promise<object>} Turno creado
 */
const insertarTurno = async (data, client = null) => {
  const db = client || pool;
  const result = await db.query(
    'INSERT INTO "Atencion" (id_paciente, id_servicio, id_especialidad, id_responsable, id_estado_actual, id_sede, numero) VALUES ($1, $2, $3, $4, 1, $5, $6) RETURNING *',
    [data.id_paciente, data.id_servicio, data.id_especialidad, data.id_responsable, data.id_sede, data.numero],
  );
  return result.rows[0];
};

const marcarAusente = async (client, id, targetState = 7) => {
  // Idempotente: no vuelve a cambiar/insertar historial si ya está en ese estado.
  const result = await client.query(
    'UPDATE "Atencion" SET id_estado_actual = $2, hora_salida = NOW() WHERE id_atencion = $1 AND id_estado_actual <> $2 RETURNING id_consultorio',
    [id, targetState],
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

/**
 * Reincorpora a la cola (estado 3) a un paciente marcado como ausente (estado 7).
 * Solo aplica si el paciente sigue en estado 7 (idempotente).
 */
const reincorporarPaciente = async (client, id) => {
  const result = await client.query(
    'UPDATE "Atencion" SET id_estado_actual = 3, hora_salida = NULL WHERE id_atencion = $1 AND id_estado_actual = 7 RETURNING *',
    [id],
  );
  return result.rows[0] || null;
};

/**
 * Toma el siguiente paciente en la cola (estado 3) de un servicio, respetando
 * el orden de llegada (más antiguo primero).
 *
 * 'FOR UPDATE SKIP LOCKED' es clave para la concurrencia: si dos médicos
 * llaman a la vez, cada uno bloquea/recibe una fila distinta y nadie llama
 * dos veces al mismo paciente.
 *
 * @param {object} client - Cliente de transacción
 * @param {number} servicioId - ID del servicio
 * @param {number} sede - ID de la sede
 * @param {number} [idEspecialidad] - Filtro opcional de especialidad
 * @returns {Promise<object|null>} Próximo paciente en espera o null si no hay
 */
const getEnEsperaPorServicio = async (client, servicioId, sede, idEspecialidad) => {
  let query = `
    SELECT a.id_atencion as id, a.numero, e.nombre_estado as estado, p.primer_nombre as nombre_paciente, p.primer_apellido as apellido_paciente, p.cedula as documento_paciente, p.telefono as telefono_paciente, a.hora_llegada,
           esp.piso as especialidad_piso
    FROM "Atencion" a
    JOIN "Pacientes" p ON a.id_paciente = p.id_paciente
    JOIN "Estado" e ON a.id_estado_actual = e.id_estado
    LEFT JOIN "Especialidades" esp ON a.id_especialidad = esp.id_especialidad
    WHERE a.id_servicio = $1 AND a.id_estado_actual = 3 AND a.id_sede = $2
  `;
  const params = [servicioId, sede];
  if (idEspecialidad) {
    query += ` AND a.id_especialidad = $3`;
    params.push(idEspecialidad);
  }
  // FOR UPDATE OF a: bloquea SOLO las filas de "Atencion" (el lado no
  // nulable). PostgreSQL no permite bloquear el lado nulable de un outer
  // join (el LEFT JOIN con Especialidades para el piso), por eso se acota
  // el bloqueo a la tabla base.
  query += ` ORDER BY a.hora_llegada ASC LIMIT 1 FOR UPDATE OF a SKIP LOCKED`;
  const result = await client.query(query, params);
  return result.rows[0] || null;
};

/**
 * Llama a un paciente: lo mueve a estado 4 (Llamado) y le asigna el consultorio.
 */
const llamarAtencion = async (client, id, consultorioId) => {
  await client.query(
    'UPDATE "Atencion" SET id_estado_actual = 4, id_consultorio = $1 WHERE id_atencion = $2',
    [consultorioId, id],
  );
};

/**
 * Busca la atención en estado 4 (Llamado) de un consultorio y la bloquea
 * (FOR UPDATE) para iniciarla. Se usa al pulsar "Iniciar atención".
 */
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

const getReporteDiario = async (sede, fecha_desde = null, fecha_hasta = null) => {
  const queryBase = `
    SELECT
      a.id_atencion as id,
      a.numero,
      e.nombre_estado as estado,
      a.id_estado_actual,
      a.hora_llegada,
      a.hora_salida as hora_fin,
      p.primer_nombre,
      p.segundo_nombre,
      p.primer_apellido,
      p.segundo_apellido,
      p.cedula as paciente_documento,
      p.telefono as paciente_telefono,
      s.nombre_servicio as servicio,
      esp.nombre as especialidad,
      c.nombre as consultorio,
      u.primer_nombre as medico_nombre,
      u.primer_apellido as medico_apellido,
      -- Horas del historial obtenidas con subconsultas escalares (NO con
      -- LEFT JOIN): si una atención tiene varios historiales del mismo estado
      -- (p. ej. Ausente marcado 2 veces), el JOIN multiplicaba la fila y el
      -- paciente aparecía repetido en el dashboard con el mismo turno/servicio.
      (SELECT MAX(h.fecha_hora) FROM "Historial_Atencion" h WHERE h.id_atencion = a.id_atencion AND h.id_estado = 5) as hora_inicio_atencion,
      (SELECT MAX(h.fecha_hora) FROM "Historial_Atencion" h WHERE h.id_atencion = a.id_atencion AND h.id_estado = 6) as hora_fin_atencion,
      (SELECT MAX(h.fecha_hora) FROM "Historial_Atencion" h WHERE h.id_atencion = a.id_atencion AND h.id_estado = 7) as hora_marcado_ausente,
      (SELECT MAX(h.fecha_hora) FROM "Historial_Atencion" h WHERE h.id_atencion = a.id_atencion AND h.id_estado = 9) as hora_retirado,
      a.id_sede
    FROM "Atencion" a
    JOIN "Pacientes" p ON a.id_paciente = p.id_paciente
    JOIN "Servicio" s ON a.id_servicio = s.id_servicio
    JOIN "Estado" e ON a.id_estado_actual = e.id_estado
    LEFT JOIN "Especialidades" esp ON a.id_especialidad = esp.id_especialidad
    LEFT JOIN "Consultorios" c ON a.id_consultorio = c.id_consultorio
    LEFT JOIN "Usuarios" u ON a.id_usuario_registro = u.id_usuario
    WHERE a.id_sede = $1
  `;
  const params = [sede];
  let fechaSql;

  if (fecha_desde && fecha_hasta) {
    params.push(fecha_desde, fecha_hasta);
    fechaSql = `AND a.hora_llegada >= $2::date AND a.hora_llegada < ($3::date + interval '1 day')`;
  } else if (fecha_desde) {
    params.push(fecha_desde);
    fechaSql = `AND a.hora_llegada >= $2::date AND a.hora_llegada < ($2::date + interval '1 day')`;
  } else {
    fechaSql = `AND a.hora_llegada >= CURRENT_DATE AND a.hora_llegada < (CURRENT_DATE + interval '1 day')`;
  }

  const result = await pool.query(
    queryBase + fechaSql + ` ORDER BY a.hora_llegada DESC`,
    params,
  );
  return result.rows;
};

const getEstadoDeAtencionPorServicio = async (servicioId) => {
  const result = await pool.query(`
    SELECT 'LIBRE' as estado, s.id_servicio as servicio_id, s.nombre_servicio as nombre, s.nombre_servicio as servicio_nombre,
      a.id_atencion as turno_id, a.numero as turno_numero,
      CASE WHEN e.nombre_estado = 'En Atencion' THEN 'EN_ATENCION' WHEN e.nombre_estado = 'Llamado' THEN 'LLAMADO' ELSE UPPER(e.nombre_estado) END as turno_estado,
      p.primer_nombre as nombre_paciente, p.primer_apellido as apellido_paciente, p.cedula as documento_paciente, a.hora_llegada as turno_hora_llegada,
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
      p.primer_nombre as nombre_paciente, p.primer_apellido as apellido_paciente, p.cedula as documento_paciente, a.hora_llegada as turno_hora_llegada,
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
      a.id_atencion, a.hora_llegada, p.primer_nombre as nombre, p.primer_apellido as apellido, p.cedula, e.nombre_estado, s.nombre_servicio,
      a.id_estado_actual, a.id_especialidad, esp.nombre as nombre_especialidad
    FROM "Atencion" a
    INNER JOIN "Pacientes" p ON a.id_paciente = p.id_paciente
    INNER JOIN "Estado" e ON a.id_estado_actual = e.id_estado
    INNER JOIN "Servicio" s ON a.id_servicio = s.id_servicio
    LEFT JOIN "Especialidades" esp ON a.id_especialidad = esp.id_especialidad
    ${whereClause}
    AND a.id_estado_actual IN (3, 4, 5)
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
      a.id_atencion, a.hora_llegada, a.hora_salida, p.primer_nombre as nombre, p.primer_apellido as apellido, p.cedula, e.nombre_estado, s.nombre_servicio,
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

const getTurneroPacientes = async (estados, servicios, responsable, sede) => {
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

  if (sede) {
    params.push(Number(sede));
    condiciones.push(`a.id_sede = $${paramIndex++}`);
  }

  const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

  const result = await pool.query(
    `SELECT DISTINCT ON (a.id_atencion)
      a.id_atencion, a.numero, a.hora_llegada, a.hora_salida, a.id_estado_actual, a.id_responsable,
      p.primer_nombre as nombre, p.primer_apellido as apellido, p.cedula,
      s.nombre_servicio, s.prefijo, s.id_servicio,
      e.nombre_estado,
      c.nombre as consultorio_nombre,
      c.piso as consultorio_piso,
      esp.piso as especialidad_piso,
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

/**
 * Lista los pacientes llamados (estado 4) de hoy, para la pantalla de sala
 * de espera. DISTINCT ON evita filas duplicadas por el JOIN con el historial.
 *
 * @returns {Promise<Array<object>>}
 */
const getSalaEspera = async () => {
  const result = await pool.query(
    `SELECT DISTINCT ON (a.id_atencion)
      a.id_atencion, a.numero, a.hora_llegada, a.hora_salida, a.id_estado_actual,
      p.primer_nombre as nombre, p.primer_apellido as apellido, p.cedula,
      s.nombre_servicio, s.prefijo, s.id_servicio,
      e.nombre_estado,
      c.nombre as consultorio_nombre,
      c.piso as consultorio_piso,
      esp.piso as especialidad_piso,
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

const limpiarEstadosPendientes = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `UPDATE "Atencion" SET id_estado_actual = 7
       WHERE hora_llegada::date < CURRENT_DATE
         AND id_estado_actual IN (1, 2, 3, 4, 5, 8)
       RETURNING id_atencion, numero, id_estado_actual`,
    );

    for (const row of result.rows) {
      await client.query(
        'INSERT INTO "Historial_Atencion" (id_atencion, id_estado) VALUES ($1, 7)',
        [row.id_atencion],
      );
    }

    await client.query(
      `UPDATE "Consultorios" SET estado_fisico = 'LIBRE' WHERE estado_fisico = 'OCUPADO'`,
    );

    await client.query('COMMIT');

    if (result.rowCount > 0) {
      console.log(`[Limpieza diaria] ${result.rowCount} paciente(s) marcado(s) como ausente(s) del día anterior.`);
    }
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[Limpieza diaria] Error al limpiar estados pendientes:', error.message);
  } finally {
    client.release();
  }
};

const getUltimoLlamado = async (sede) => {
  // Solo devuelve llamados RECIENTES: los registros que quedaron atascados en
  // estado "Llamado" desde hace mucho tiempo (p. ej. por fallos de flujo) no
  // deben volver a anunciarse cada vez que el turnero consulta el endpoint.
  const result = await pool.query(
    `SELECT a.id_atencion, a.numero,
            p.primer_nombre, p.primer_apellido,
            c.nombre as consultorio_nombre,
            c.piso as consultorio_piso,
            esp.piso as especialidad_piso,
            s.nombre_servicio,
            (SELECT h.fecha_hora FROM "Historial_Atencion" h
             WHERE h.id_atencion = a.id_atencion AND h.id_estado = 4
             ORDER BY h.fecha_hora DESC LIMIT 1) as hora_llamado
     FROM "Atencion" a
     JOIN "Pacientes" p ON a.id_paciente = p.id_paciente
     LEFT JOIN "Consultorios" c ON a.id_consultorio = c.id_consultorio
     LEFT JOIN "Especialidades" esp ON a.id_especialidad = esp.id_especialidad
     LEFT JOIN "Servicio" s ON a.id_servicio = s.id_servicio
     WHERE a.id_sede = $1 AND a.id_estado_actual = 4 AND a.hora_salida IS NULL
       AND (SELECT h.fecha_hora FROM "Historial_Atencion" h
            WHERE h.id_atencion = a.id_atencion AND h.id_estado = 4
            ORDER BY h.fecha_hora DESC LIMIT 1) >= NOW() - INTERVAL '10 minutes'
     ORDER BY hora_llamado DESC NULLS LAST LIMIT 1`,
    [sede],
  );
  return result.rows[0] || null;
};

module.exports = {
  getUltimasAdmisiones,
  getAdmisionById,
  getAtencionEstado,
  getAtencionesDePaciente,
  actualizarAtencionConServicio,
  actualizarAtencionSimple,
  eliminarAtencion,
  eliminarAtencionesDePaciente,
  actualizarEstadoAtencion,
  getSiguienteNumero,
  insertarAtencion,
  getTodosLosTurnos,
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
  getUltimoLlamado,
  limpiarEstadosPendientes,
};
