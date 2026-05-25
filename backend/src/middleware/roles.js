const roleMiddleware = (...rolesPermitidos) => {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ mensaje: 'No hay usuario autenticado' });
    }
    if (!rolesPermitidos.flat().includes(req.usuario.rol)) {
      console.warn(`Acceso denegado para usuario con rol: ${req.usuario.rol}`);
      return res.status(403).json({ mensaje: 'No tienes permisos para realizar esta acción' });
    }
    next();
  };
};

module.exports = roleMiddleware;
