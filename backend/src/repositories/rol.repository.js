/**
 * Repositorio de roles (tabla "Roles").
 *
 * Un rol pertenece a una sede (id_sede NULL = rol global aplicable a todas
 * las sedes; ver migraciones 008 y 009 que hicieron la key única por sede).
 * Los permisos asociados a cada rol se manejan en permiso.repository.js.
 */
const pool = require('../config/db');

/**
 * Lista todos los roles con el nombre de su sede.
 *
 * @param {number|null} sede - ID de la sede; null devuelve todos los roles
 * @returns {Promise<Array<object>>}
 */
const getAll = async (sede) => {
  let query = `SELECT r.id_rol as id, r.nombre, r.key, r.id_sede, r.activo, s.nombre as sede_nombre
     FROM "Roles" r
     LEFT JOIN "Sedes" s ON r.id_sede = s.id_sede`;
  const params = [];
  if (sede != null) {
    query += ` WHERE r.id_sede = $1`;
    params.push(sede);
  }
  query += ` ORDER BY r.id_rol`;
  const result = await pool.query(query, params);
  return result.rows;
};

const getById = async (id) => {
  const result = await pool.query(
    `SELECT id_rol as id, nombre, key, id_sede, activo
     FROM "Roles"
     WHERE id_rol = $1`,
    [id]
  );
  return result.rows[0] || null;
};

const create = async (nombre, key, id_sede, activo) => {
  const result = await pool.query(
    `INSERT INTO "Roles" (nombre, key, id_sede, activo)
     VALUES ($1, $2, $3, $4)
     RETURNING id_rol as id`,
    [nombre, key, id_sede || null, activo !== false]
  );
  return result.rows[0];
};

const update = async (id, nombre, key, id_sede, activo) => {
  await pool.query(
    `UPDATE "Roles"
     SET nombre = COALESCE($1, nombre),
         key = COALESCE($2, key),
         id_sede = $3,
         activo = COALESCE($4, activo)
     WHERE id_rol = $5`,
    [nombre, key, id_sede || null, activo !== undefined ? activo : null, id]
  );
};

const remove = async (id) => {
  await pool.query(`DELETE FROM "Roles" WHERE id_rol = $1`, [id]);
};

const existsKeyGlobally = async (key) => {
  const result = await pool.query('SELECT id_rol FROM "Roles" WHERE key = $1', [key]);
  return result.rows.length > 0;
};

const existsKeyForSede = async (key, id_sede) => {
  const result = await pool.query('SELECT id_rol FROM "Roles" WHERE key = $1 AND id_sede = $2', [key, id_sede || null]);
  return result.rows.length > 0;
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  remove,
  existsKeyGlobally,
  existsKeyForSede,
};
