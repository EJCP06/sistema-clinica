/**
 * Configuración del logger central de la aplicación (Winston).
 *
 * - En desarrollo: solo consola con colores, nivel debug.
 * - En producción: consola + archivos rotativos en backend/logs/
 *   (error.log para errores y combined.log para todo).
 *
 * Uso:
 *   const logger = require('../config/logger');
 *   logger.info('mensaje', { contexto });
 *   logger.error('mensaje', { error: err.message });
 */
const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Carpeta de logs (backend/logs); se crea automáticamente si no existe.
const logDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

const logger = winston.createLogger({
  // En producción se registra a partir de 'info' para reducir ruido; en dev se incluye 'debug'.
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  defaultMeta: { service: 'clinica-api' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length > 1 ? ` ${JSON.stringify(meta)}` : '';
          return `${timestamp} [${level}]: ${message}${metaStr}`;
        }),
      ),
    }),
  ],
});

// En producción también se persisten los logs en disco, rotando cada 10 MB (se conservan 5 archivos).
if (process.env.NODE_ENV === 'production') {
  logger.add(new winston.transports.File({
    filename: path.join(logDir, 'error.log'),
    level: 'error',
    maxsize: 10 * 1024 * 1024,
    maxFiles: 5,
  }));
  logger.add(new winston.transports.File({
    filename: path.join(logDir, 'combined.log'),
    maxsize: 10 * 1024 * 1024,
    maxFiles: 5,
  }));
}

module.exports = logger;
