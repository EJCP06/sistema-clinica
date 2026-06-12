const logger = require('../config/logger');

const permissionMiddleware = (...permisosRequeridos) => {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ mensaje: 'No hay usuario autenticado' });
    }
    const permisosUsuario = req.usuario.permisos || [];
    const tienePermiso = permisosRequeridos.some(p => permisosUsuario.includes(p));
    if (!tienePermiso) {
      logger.warn(`Acceso denegado. Permisos requeridos: ${permisosRequeridos.join(', ')}. Permisos del usuario: ${permisosUsuario.join(', ')}`);
      return res.status(403).json({ mensaje: 'No tienes permisos para realizar esta acción' });
    }
    next();
  };
};

module.exports = permissionMiddleware;
