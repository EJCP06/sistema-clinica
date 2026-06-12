const pool = require('../config/db');

const getAll = async () => {
  const result = await pool.query(
    'SELECT id_permiso as id, key, nombre, descripcion, fecha_creacion FROM "Permisos" ORDER BY nombre'
  );
  return result.rows;
};

const getByRolId = async (idRol) => {
  const result = await pool.query(
    `SELECT p.id_permiso as id, p.key, p.nombre, p.descripcion
     FROM "Permisos" p
     INNER JOIN "Roles_Permisos" rp ON p.id_permiso = rp.id_permiso
     WHERE rp.id_rol = $1
     ORDER BY p.nombre`,
    [idRol]
  );
  return result.rows;
};

const getKeysByRolId = async (idRol) => {
  const result = await pool.query(
    `SELECT p.key FROM "Permisos" p
     INNER JOIN "Roles_Permisos" rp ON p.id_permiso = rp.id_permiso
     WHERE rp.id_rol = $1`,
    [idRol]
  );
  return result.rows.map(r => r.key);
};

const create = async (key, nombre, descripcion) => {
  const result = await pool.query(
    `INSERT INTO "Permisos" (key, nombre, descripcion)
     VALUES ($1, $2, $3)
     RETURNING id_permiso as id`,
    [key, nombre, descripcion]
  );
  return result.rows[0];
};

const update = async (id, key, nombre, descripcion) => {
  await pool.query(
    `UPDATE "Permisos" SET key = COALESCE($1, key), nombre = COALESCE($2, nombre), descripcion = $3
     WHERE id_permiso = $4`,
    [key, nombre, descripcion || null, id]
  );
};

const remove = async (id) => {
  await pool.query('DELETE FROM "Permisos" WHERE id_permiso = $1', [id]);
};

const asignarPermisos = async (idRol, permisosKeys) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM "Roles_Permisos" WHERE id_rol = $1', [idRol]);
    if (permisosKeys && permisosKeys.length > 0) {
      const result = await client.query(
        `SELECT id_permiso, key FROM "Permisos" WHERE key = ANY($1)`,
        [permisosKeys]
      );
      if (result.rows.length > 0) {
        const values = result.rows.map((r, i) => `($1, $${i + 2})`).join(',');
        await client.query(
          `INSERT INTO "Roles_Permisos" (id_rol, id_permiso) VALUES ${values}`,
          [idRol, ...result.rows.map(r => r.id_permiso)]
        );
      }
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  getAll,
  getByRolId,
  getKeysByRolId,
  create,
  update,
  remove,
  asignarPermisos,
};