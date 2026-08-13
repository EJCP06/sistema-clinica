/**
 * Repositorio de especialidades médicas.
 *
 * Una especialidad pertenece a un servicio y puede estar asociada a varios
 * consultorios mediante la tabla intermedia "Especialidad_Consultorio".
 * Varias funciones reciben `client` (cliente de transacción) porque se usan
 * dentro de operaciones atómicas (crear/editar especialidad + sus consultorios).
 */
const db = require('../config/db');

/**
 * Lista todas las especialidades con el nombre de su servicio, opcionalmente
 * filtradas por sede.
 *
 * @param {string|number} sede - ID de la sede; 0/indefinido devuelve todas
 * @returns {Promise<Array<object>>}
 */
const getAll = async (sede) => {
  let query = `
    SELECT e.*, e.id_especialidad as id,
           s.nombre_servicio
    FROM "Especialidades" e
    JOIN "Servicio" s ON e.id_servicio = s.id_servicio
  `;
  const params = [];
  
  if (sede && Number(sede) !== 0) {
    query += ` WHERE e.id_sede = $1`;
    params.push(Number(sede));
  }
  
  query += ` ORDER BY e.nombre ASC`;
  
  const result = await db.query(query, params);
  return result.rows;
};

const getConsultoriosByEspecialidad = async () => {
  const result = await db.query(
    `SELECT id_especialidad, id_consultorio FROM "Especialidad_Consultorio"`
  );
  return result.rows;
};

/**
 * Crea una especialidad dentro de una transacción.
 *
 * @param {object} client - Cliente de transacción
 * @param {object} data - Datos de la especialidad (nombre, prefijo, id_servicio, id_sede, piso, activo)
 * @returns {Promise<object>} Especialidad creada
 */
const create = async (client, data) => {
  const result = await client.query(
    `INSERT INTO "Especialidades" (nombre, prefijo, id_servicio, id_sede, piso, activo)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [data.nombre, data.prefijo, data.id_servicio, data.id_sede, data.piso, data.activo !== false],
  );
  return result.rows[0];
};

const insertConsultorioRelation = async (client, espId, conId) => {
  await client.query(
    `INSERT INTO "Especialidad_Consultorio" (id_especialidad, id_consultorio) VALUES ($1, $2)`,
    [espId, conId],
  );
};

/**
 * Actualiza parcialmente una especialidad con columnas dinámicas (SET construido
 * por el controlador). El índice `idx` indica la posición del parámetro $N del id.
 *
 * @param {object} client - Cliente de transacción
 * @param {number} id - ID de la especialidad
 * @param {string[]} sets - Fragmentos 'columna = $N' ya armados
 * @param {Array} values - Valores de los parámetros
 * @param {number} idx - Número de parámetro que corresponde al id
 */
const update = async (client, id, sets, values, idx) => {
  values.push(id);
  await client.query(
    `UPDATE "Especialidades" SET ${sets.join(', ')} WHERE id_especialidad = $${idx} RETURNING *`,
    values,
  );
};

const deleteConsultorioRelations = async (client, id) => {
  await client.query(`DELETE FROM "Especialidad_Consultorio" WHERE id_especialidad = $1`, [id]);
};

const remove = async (id) => {
  await db.query('DELETE FROM "Especialidad_Consultorio" WHERE id_especialidad = $1', [id]);
  await db.query('DELETE FROM "Especialidades" WHERE id_especialidad = $1', [id]);
};

const getById = async (id) => {
  const result = await db.query(`SELECT * FROM "Especialidades" WHERE id_especialidad = $1`, [id]);
  return result.rows[0] || null;
};

const esEspecialidadActiva = async (id_especialidad, sede) => {
  const result = await db.query(
    `SELECT activo FROM "Especialidades" WHERE id_especialidad = $1 AND id_sede = $2`,
    [id_especialidad, sede],
  );
  const row = result.rows[0];
  return row ? row.activo === true : false;
};

const getConsultorioIdsByEspecialidad = async (id) => {
  const result = await db.query(
    `SELECT id_consultorio FROM "Especialidad_Consultorio" WHERE id_especialidad = $1`, [id],
  );
  return result.rows.map((r) => r.id_consultorio);
};

module.exports = {
  getAll,
  getConsultoriosByEspecialidad,
  create,
  insertConsultorioRelation,
  update,
  deleteConsultorioRelations,
  remove,
  getById,
  getConsultorioIdsByEspecialidad,
  esEspecialidadActiva,
};
