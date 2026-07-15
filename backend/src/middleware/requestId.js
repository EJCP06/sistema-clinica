const { v4: uuidv4 } = require('uuid');

/**
 * Middleware que asigna un UUID único a cada petición entrante y lo
 * expone en el encabezado de respuesta X-Request-Id para facilitar
 * la trazabilidad en logs y depuración.
 *
 * @param {import('express').Request} req - Petición HTTP
 * @param {import('express').Response} res - Respuesta HTTP
 * @param {import('express').NextFunction} next - Siguiente middleware
 * @returns {void}
 */
const requestIdMiddleware = (req, res, next) => {
  req.id = uuidv4();
  res.setHeader('X-Request-Id', req.id);
  next();
};

module.exports = requestIdMiddleware;
