const pool = require('../config/db');

const getAll = async () => {
  const result = await pool.query(
    `SELECT id_servicio as id, nombre_servicio as nombre, prefijo, status as activo
     FROM "Servicio"
     ORDER BY id_servicio`,
  );
  return result.rows;
};

const getById = async (id) => {
  const result = await pool.query('SELECT id_servicio, nombre_servicio, prefijo FROM "Servicio" WHERE id_servicio = $1', [id]);
  return result.rows[0] || null;
};

const getPrefijo = async (id) => {
  const result = await pool.query('SELECT prefijo FROM "Servicio" WHERE id_servicio = $1', [id]);
  return result.rows[0]?.prefijo || 'T';
};

const getNombre = async (id) => {
  const result = await pool.query('SELECT nombre_servicio FROM "Servicio" WHERE id_servicio = $1', [id]);
  return result.rows[0]?.nombre_servicio || null;
};

const create = async (nombre, prefijo, piso, activo) => {
  await pool.query(
    `INSERT INTO "Servicio" (nombre_servicio, prefijo, piso, status) VALUES ($1, $2, $3, $4)`,
    [nombre, prefijo || null, piso || null, activo !== false],
  );
};

const update = async (id, nombre, prefijo, piso, activo) => {
  await pool.query(
    `UPDATE "Servicio"
     SET nombre_servicio = COALESCE($1, nombre_servicio),
         prefijo = COALESCE($2, prefijo),
         piso = COALESCE($3, piso),
         status = COALESCE($4, status)
     WHERE id_servicio = $5`,
    [nombre, prefijo || null, piso || null, activo !== undefined ? activo : null, id],
  );
};

const remove = async (id) => {
  await pool.query(`DELETE FROM "Servicio" WHERE id_servicio = $1`, [id]);
};

const findByNameLike = async (nombreLike) => {
  const result = await pool.query(
    'SELECT id_servicio FROM "Servicio" WHERE LOWER(nombre_servicio) LIKE LOWER($1) LIMIT 1',
    [nombreLike],
  );
  return result.rows[0] || null;
};

module.exports = {
  getAll,
  getById,
  getPrefijo,
  getNombre,
  create,
  update,
  remove,
  findByNameLike,
};
