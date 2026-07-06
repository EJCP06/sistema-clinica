const pool = require('../config/db');

const findUsuarioByEmailYCedula = async (email, cedula) => {
  const result = await pool.query(
    'SELECT id_usuario, email, cedula FROM "Usuarios" WHERE LOWER(email) = LOWER($1) AND cedula = $2',
    [email.trim(), cedula.trim()],
  );
  return result.rows[0] || null;
};

const invalidarCodigosPendientes = async (idUsuario) => {
  await pool.query(
    'UPDATE "Recuperacion_Clave" SET usado = true WHERE id_usuario = $1 AND usado = false',
    [idUsuario],
  );
};

const insertarCodigo = async (idUsuario, codigo) => {
  await pool.query(
    'INSERT INTO "Recuperacion_Clave" (id_usuario, codigo, expiracion) VALUES ($1, $2, NOW() + INTERVAL \'3 minutes\')',
    [idUsuario, codigo],
  );
};

const findCodigoValido = async (email, cedula) => {
  const result = await pool.query(
    `SELECT rc.id_recuperacion, rc.codigo, rc.expiracion, rc.intentos
     FROM "Recuperacion_Clave" rc
     JOIN "Usuarios" u ON rc.id_usuario = u.id_usuario
     WHERE LOWER(u.email) = LOWER($1) AND u.cedula = $2 AND rc.usado = false
     ORDER BY rc.fecha_creacion DESC LIMIT 1`,
    [email.trim(), cedula.trim()],
  );
  return result.rows[0] || null;
};

const incrementarIntentos = async (idRecuperacion) => {
  await pool.query(
    'UPDATE "Recuperacion_Clave" SET intentos = COALESCE(intentos, 0) + 1 WHERE id_recuperacion = $1',
    [idRecuperacion],
  );
};

const marcarUsado = async (idRecuperacion) => {
  await pool.query('UPDATE "Recuperacion_Clave" SET usado = true WHERE id_recuperacion = $1', [idRecuperacion]);
};

const updatePassword = async (cedula, passwordHash) => {
  await pool.query('UPDATE "Usuarios" SET password_hash = $1 WHERE cedula = $2', [passwordHash, cedula.trim()]);
};

module.exports = {
  findUsuarioByEmailYCedula,
  invalidarCodigosPendientes,
  insertarCodigo,
  findCodigoValido,
  incrementarIntentos,
  marcarUsado,
  updatePassword,
};
