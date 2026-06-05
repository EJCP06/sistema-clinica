const pool = require('../config/db');

const findByCedula = async (cedula) => {
  const result = await pool.query(`
    SELECT u.id_usuario as id, u.cedula, u.password_hash, u.rol, u.nombre, u.apellido,
           u.id_servicio as servicio_id, u.id_consultorio as consultorio_id, u.id_sede,
           u.id_especialidad, e.nombre as especialidad_nombre
    FROM "Usuarios" u
    LEFT JOIN "Especialidades" e ON u.id_especialidad = e.id_especialidad
    WHERE u.cedula = $1
  `, [cedula]);
  return result.rows[0] || null;
};

const findByCedulaSimple = async (cedula) => {
  const result = await pool.query('SELECT id_usuario FROM "Usuarios" WHERE cedula = $1', [cedula]);
  return result.rows[0] || null;
};

const updatePasswordByCedula = async (cedula, passwordHash) => {
  await pool.query('UPDATE "Usuarios" SET password_hash = $1 WHERE cedula = $2', [passwordHash, cedula]);
};

const findByCedulaAndEmail = async (email, cedula) => {
  const result = await pool.query(
    'SELECT id_usuario, email, cedula FROM "Usuarios" WHERE LOWER(email) = LOWER($1) AND cedula = $2',
    [email.trim(), cedula.trim()],
  );
  return result.rows[0] || null;
};

const deleteByCedula = async (cedula) => {
  await pool.query('DELETE FROM "Usuarios" WHERE cedula = $1', [cedula]);
};

const insertAdmin = async (hash, rol, nombre, apellido, cedula, idSede, status) => {
  await pool.query(
    'INSERT INTO "Usuarios" (password_hash, rol, nombre, apellido, cedula, id_sede, status) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [hash, rol, nombre, apellido, cedula, idSede, status],
  );
};

const getPersonal = async (sede) => {
  const result = await pool.query(
    `SELECT
      u.id_usuario, u.cedula, u.rol, u.nombre, u.apellido, u.telefono, u.email,
      u.piso, u.id_consultorio, u.id_servicio, u.id_especialidad, u.id_sede, u.status,
      u.fecha_creacion, c.nombre AS consultorio_nombre, s.nombre_servicio AS servicio_nombre
    FROM "Usuarios" u
    LEFT JOIN "Consultorios" c ON u.id_consultorio = c.id_consultorio
    LEFT JOIN "Servicio" s ON u.id_servicio = s.id_servicio
    WHERE u.id_sede = $1
    ORDER BY u.nombre, u.apellido`,
    [sede],
  );
  return result.rows;
};

const crearPersonal = async (data) => {
  const result = await pool.query(
    `INSERT INTO "Usuarios" (cedula, nombre, apellido, telefono, email, password_hash, rol, piso, id_consultorio, id_servicio, id_especialidad, id_sede, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING id_usuario`,
    [data.cedula, data.nombre, data.apellido, data.telefono, data.email, data.password_hash, data.rol, data.piso, data.id_consultorio, data.id_servicio, data.id_especialidad, data.sede, data.status],
  );
  return result.rows[0];
};

const actualizarPersonal = async (id, sede, sets, values, idx) => {
  values.push(id, sede);
  await pool.query(
    `UPDATE "Usuarios" SET ${sets.join(', ')} WHERE id_usuario = $${idx} AND id_sede = $${idx + 1}`,
    values,
  );
};

const eliminarPersonal = async (id, sede) => {
  const result = await pool.query(
    'DELETE FROM "Usuarios" WHERE id_usuario = $1 AND id_sede = $2 RETURNING id_usuario',
    [id, sede],
  );
  return result.rowCount > 0;
};

module.exports = {
  findByCedula,
  findByCedulaSimple,
  updatePasswordByCedula,
  findByCedulaAndEmail,
  deleteByCedula,
  insertAdmin,
  getPersonal,
  crearPersonal,
  actualizarPersonal,
  eliminarPersonal,
};
