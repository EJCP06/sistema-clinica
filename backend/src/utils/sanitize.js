const logger = require('../config/logger');

const SENSITIVE_FIELDS = [
  'password', 'password_hash', 'token', 'refreshToken', 'refresh_token',
  'accessToken', 'authorization', 'secret', 'apiKey', 'api_key',
];

/**
 * Crea una copia segura de un error eliminando campos sensibles del
 * contexto para evitar fugas de información en los logs.
 *
 * @param {Error} error - Error original
 * @param {object} [context={}] - Contexto adicional de la petición
 * @returns {object} Objeto sanitizado con message, code, status y contexto filtrado
 */
const sanitizeError = (error, context = {}) => {
  const safe = { message: error?.message || 'Error desconocido' };
  if (error?.code) safe.code = error.code;
  if (error?.status || error?.statusCode) safe.status = error.status || error.statusCode;
  if (typeof context === 'object' && context !== null) {
    for (const [key, value] of Object.entries(context)) {
      if (!SENSITIVE_FIELDS.some(f => key.toLowerCase().includes(f))) {
        safe[key] = value;
      }
    }
  }
  return safe;
};

/**
 * Registra un error en el logger después de sanitizarlo, evitando
 * exponer tokens, contraseñas u otros datos sensibles.
 *
 * @param {string} message - Mensaje descriptivo del error
 * @param {Error} error - Error original
 * @param {object} [context={}] - Contexto adicional
 * @returns {void}
 */
const logErrorSafe = (message, error, context = {}) => {
  logger.error(message, sanitizeError(error, context));
};

module.exports = { sanitizeError, logErrorSafe };
