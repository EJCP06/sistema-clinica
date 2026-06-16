const pool = require('../config/db');

const getAll = async (sede) => {
  const result = await pool.query(
    `SELECT r.id_rol as id, r.nombre, r.key, r.id_sede, r.activo, s.nombre as sede_nombre
     FROM "Roles" r
     LEFT JOIN "Sedes" s ON r.id_sede = s.id_sede
     WHERE r.id_sede IS NULL OR r.id_sede = $1
     ORDER BY r.id_rol`,
    [sede]
  );
  return result.rows;
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
  create,
  update,
  remove,
  existsKeyGlobally,
  existsKeyForSede,
};
