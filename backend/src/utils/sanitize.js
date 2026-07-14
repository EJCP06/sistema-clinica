const logger = require('../config/logger');

const SENSITIVE_FIELDS = [
  'password', 'password_hash', 'token', 'refreshToken', 'refresh_token',
  'accessToken', 'authorization', 'secret', 'apiKey', 'api_key',
];

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

const logErrorSafe = (message, error, context = {}) => {
  logger.error(message, sanitizeError(error, context));
};

module.exports = { sanitizeError, logErrorSafe };