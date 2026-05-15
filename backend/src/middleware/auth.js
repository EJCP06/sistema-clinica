const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ mensaje: 'No hay token proporcionado, autorización denegada' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'clinica-secret-key');
    if (!decoded || !decoded.id || !decoded.rol) {
      return res.status(401).json({ mensaje: 'Token inválido o incompleto' });
    }
    req.usuario = decoded;
    next();
  } catch (err) {
    console.error('Error en authMiddleware:', err);
    res.status(401).json({ mensaje: 'Token no válido' });
  }
};

module.exports = authMiddleware;
