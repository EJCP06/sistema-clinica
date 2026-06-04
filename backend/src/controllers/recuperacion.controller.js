const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const pool = require('../config/db');
const { enviarCorreoOTP } = require('../config/email');

const solicitar = async (req, res) => {
  const { email, cedula } = req.body;

  if (!email || !cedula) {
    return res.status(400).json({ mensaje: 'Correo y cédula son requeridos' });
  }

  try {
    const result = await pool.query(
      'SELECT id_usuario, email, cedula FROM "Usuarios" WHERE LOWER(email) = LOWER($1) AND cedula = $2',
      [email.trim(), cedula.trim()],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ mensaje: 'Correo o cédula incorrectos' });
    }

    const usuario = result.rows[0];

    const codigo = crypto.randomInt(100000, 999999).toString();

    await pool.query(
      'UPDATE "Recuperacion_Clave" SET usado = true WHERE id_usuario = $1 AND usado = false',
      [usuario.id_usuario],
    );

     await pool.query(
       'INSERT INTO "Recuperacion_Clave" (id_usuario, codigo, expiracion) VALUES ($1, $2, NOW() + INTERVAL \'3 minutes\')',
       [usuario.id_usuario, codigo],
     );

    try {
      await enviarCorreoOTP(usuario.email, codigo);
    } catch (emailError) {
      return res.status(500).json({ mensaje: 'Error al enviar el correo. Verifica la configuración de email.' });
    }

     res.json({ mensaje: 'Código enviado al correo registrado', expiracion: 180 });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error interno' });
  }
};

const verificar = async (req, res) => {
  const { email, cedula, codigo } = req.body;

  if (!email || !cedula || !codigo) {
    return res.status(400).json({ mensaje: 'Correo, cédula y código son requeridos' });
  }

  try {
    const result = await pool.query(
      `SELECT rc.id_recuperacion, rc.codigo, rc.expiracion
       FROM "Recuperacion_Clave" rc
       JOIN "Usuarios" u ON rc.id_usuario = u.id_usuario
       WHERE LOWER(u.email) = LOWER($1) AND u.cedula = $2 AND rc.usado = false
       ORDER BY rc.fecha_creacion DESC LIMIT 1`,
      [email.trim(), cedula.trim()],
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ mensaje: 'No hay código pendiente. Solicita uno nuevo.' });
    }

    const registro = result.rows[0];

    if (new Date() > new Date(registro.expiracion)) {
      await pool.query('UPDATE "Recuperacion_Clave" SET usado = true WHERE id_recuperacion = $1', [registro.id_recuperacion]);
      return res.status(400).json({ mensaje: 'El código ha expirado. Solicita uno nuevo.' });
    }

    if (registro.codigo !== codigo) {
      return res.status(400).json({ mensaje: 'Código incorrecto' });
    }

    res.json({ mensaje: 'Código verificado correctamente' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error interno' });
  }
};

const restablecer = async (req, res) => {
  const { email, cedula, codigo, newPassword } = req.body;

  if (!email || !cedula || !codigo || !newPassword) {
    return res.status(400).json({ mensaje: 'Todos los campos son requeridos' });
  }

  if (newPassword.length < 4) {
    return res.status(400).json({ mensaje: 'La contraseña debe tener al menos 4 caracteres' });
  }

  try {
    const result = await pool.query(
      `SELECT rc.id_recuperacion, rc.codigo, rc.expiracion
       FROM "Recuperacion_Clave" rc
       JOIN "Usuarios" u ON rc.id_usuario = u.id_usuario
       WHERE LOWER(u.email) = LOWER($1) AND u.cedula = $2 AND rc.usado = false
       ORDER BY rc.fecha_creacion DESC LIMIT 1`,
      [email.trim(), cedula.trim()],
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ mensaje: 'No hay código pendiente. Solicita uno nuevo.' });
    }

    const registro = result.rows[0];

    if (new Date() > new Date(registro.expiracion)) {
      await pool.query('UPDATE "Recuperacion_Clave" SET usado = true WHERE id_recuperacion = $1', [registro.id_recuperacion]);
      return res.status(400).json({ mensaje: 'El código ha expirado. Solicita uno nuevo.' });
    }

    if (registro.codigo !== codigo) {
      return res.status(400).json({ mensaje: 'Código incorrecto' });
    }

    const password_hash = await bcrypt.hash(newPassword, 10);
    await pool.query(
      'UPDATE "Usuarios" SET password_hash = $1 WHERE cedula = $2',
      [password_hash, cedula.trim()],
    );

    await pool.query('UPDATE "Recuperacion_Clave" SET usado = true WHERE id_recuperacion = $1', [registro.id_recuperacion]);

    res.json({ mensaje: 'Contraseña actualizada exitosamente' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error interno' });
  }
};

module.exports = { solicitar, verificar, restablecer };
