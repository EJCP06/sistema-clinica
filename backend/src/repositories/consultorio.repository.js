/**
 * Repositorio de consultorios: toda la lógica SQL relacionada con la tabla
 * "Consultorios" (estado físico del consultorio, servicio asignado, sede).
 *
 * Nota sobre el parámetro `client`: cuando se pasa, las consultas se ejecutan
 * dentro de la transacción del cliente (para operaciones atómicas); si no se
 * pasa, se usa el pool global. Ver getConsultorioById y setEstadoFisico.
 */
const pool = require('../config/db');

/**
 * Lista los consultorios de una sede (o todos si sede es 0/indefinida).
 *
 * @param {string|number} sede - ID de la sede; 0 o indefinido devuelve todos
 * @returns {Promise<Array<object>>}
 */
const getConsultoriosBySede = async (sede) => {
  let query = `SELECT id_consultorio as id, nombre, estado_fisico as estado, id_servicio as servicio_id
     FROM "Consultorios"`;
  const params = [];
  
  if (sede && Number(sede) !== 0) {
    query += ` WHERE id_sede = $1`;
    params.push(Number(sede));
  }
  
  const result = await pool.query(query, params);
  return result.rows;
};

/**
 * Obtiene un consultorio bloqueándolo con FOR UPDATE.
 * Admite dos firmas: (client, id) para uso dentro de transacciones, o (id) con pool global.
 *
 * @param {object|number} clientOrId - Cliente de transacción o ID del consultorio
 * @param {number} [idOnly] - ID del consultorio cuando el primer parámetro es un cliente
 * @returns {Promise<object|null>} Consultorio o null si no existe
 */
const getConsultorioById = async (clientOrId, idOnly) => {
  const client = idOnly !== undefined ? clientOrId : pool;
  const consultorioId = idOnly !== undefined ? idOnly : clientOrId;
  const result = await client.query(
    'SELECT estado_fisico as estado, id_servicio as servicio_id, nombre FROM "Consultorios" WHERE id_consultorio = $1 FOR UPDATE',
    [consultorioId],
  );
  return result.rows[0] || null;
};

const createConsultorio = async (nombre, sede) => {
  await pool.query(
    `INSERT INTO "Consultorios" (nombre, id_sede) VALUES ($1, $2)`,
    [nombre, sede],
  );
};

const updateConsultorio = async (id, sede, nombre) => {
  await pool.query(
    `UPDATE "Consultorios" SET nombre = $1 WHERE id_consultorio = $2 AND id_sede = $3`,
    [nombre, id, sede],
  );
};

const deleteConsultorio = async (id, sede) => {
  await pool.query(
    `DELETE FROM "Consultorios" WHERE id_consultorio = $1 AND id_sede = $2`,
    [id, sede],
  );
};

/**
 * Actualiza el estado físico de un consultorio dentro de una transacción.
 *
 * @param {object} client - Cliente de transacción (obligatorio, se usa en flujos atómicos)
 * @param {number} consultorioId - ID del consultorio
 * @param {string} estado - Nuevo estado físico (ej. 'ocupado', 'disponible')
 */
const setEstadoFisico = async (client, consultorioId, estado) => {
  await client.query(
    'UPDATE "Consultorios" SET estado_fisico = $1 WHERE id_consultorio = $2',
    [estado, consultorioId],
  );
};

module.exports = {
  getConsultoriosBySede,
  getConsultorioById,
  createConsultorio,
  updateConsultorio,
  deleteConsultorio,
  setEstadoFisico,
};
