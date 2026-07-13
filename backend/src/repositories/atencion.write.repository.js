const pool = require('../config/db');

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

const insertarAtencion = async (data) => {
  const result = await pool.query(
    `INSERT INTO "Atencion" (id_paciente, id_servicio, id_responsable, id_estado_actual, id_sede, id_usuario_registro, numero, id_cliente, id_especialidad, id_medico, id_consultorio)
     VALUES ($1, $2, $3, 1, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id_atencion, numero, hora_llegada`,
    [data.id_paciente, data.id_servicio, data.id_responsable || null, data.sede, data.usuarioId || null, data.numero, data.id_cliente || null, data.id_especialidad || null, data.id_medico || null, data.id_consultorio || null],
  );
  return result.rows[0];
};

const insertarTurno = async (data) => {
  const result = await pool.query(
    'INSERT INTO "Atencion" (id_paciente, id_servicio, id_especialidad, id_responsable, id_estado_actual, id_sede, numero) VALUES ($1, $2, $3, $4, 1, $5, $6) RETURNING *',
    [data.id_paciente, data.id_servicio, data.id_especialidad, data.id_responsable, data.id_sede, data.numero],
  );
  return result.rows[0];
};

const marcarAusente = async (client, id, targetState = 7) => {
  const result = await client.query(
    'UPDATE "Atencion" SET id_estado_actual = $2, hora_salida = NOW() WHERE id_atencion = $1 RETURNING id_consultorio',
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

const reincorporarPaciente = async (client, id) => {
  const result = await client.query(
    'UPDATE "Atencion" SET id_estado_actual = 3, hora_salida = NULL WHERE id_atencion = $1 AND id_estado_actual = 7 RETURNING *',
    [id],
  );
  return result.rows[0] || null;
};

const llamarAtencion = async (client, id, consultorioId) => {
  await client.query(
    'UPDATE "Atencion" SET id_estado_actual = 4, id_consultorio = $1 WHERE id_atencion = $2',
    [consultorioId, id],
  );
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

module.exports = {
  actualizarAtencionConServicio,
  actualizarAtencionSimple,
  eliminarAtencion,
  actualizarEstadoAtencion,
  insertarAtencion,
  insertarTurno,
  marcarAusente,
  finalizarAtencionTransferencia,
  reincorporarPaciente,
  llamarAtencion,
  setAtencionEstado,
  finalizarPorConsultorio,
  finalizarPorServicio,
  liberarEnConsultorio,
  liberarEnServicio,
  getTurnoConConsultorio,
};
