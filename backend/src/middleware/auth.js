const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ mensaje: 'No token' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const result = await pool.query(
      'SELECT sesion_token, status FROM "Usuarios" WHERE id_usuario = $1',
      [decoded.id],
    );

    const usuario = result.rows[0];
    if (!usuario || usuario.status === false) {
      return res.status(401).json({ mensaje: 'Sesión inválida. Tu usuario ha sido desactivado.' });
    }
    if (usuario.sesion_token !== decoded.sesion_token) {
      return res.status(401).json({ mensaje: 'Sesión inválida. Otro usuario ha iniciado sesión con tus credenciales.' });
    }

    req.usuario = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ mensaje: 'Token inválido' });
  }
};

module.exports = authMiddleware;
