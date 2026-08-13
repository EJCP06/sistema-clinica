/**
 * Configuración de la conexión a PostgreSQL.
 *
 * Exporta un pool (pool de conexiones) reutilizado por todo el backend.
 * Los parámetros de conexión provienen del archivo backend/.env.
 *
 * Uso:
 *   const pool = require('../config/db');
 *   await pool.query('SELECT ...', [params]);
 *
 * Nota: todas las consultas deben usar parámetros ($1, $2...) para evitar
 * inyección SQL (ver backend/src/utils/sanitize.js y los repositorios).
 */
const { Pool } = require('pg');
const path = require('path');
const dotenv = require('dotenv');
const logger = require('./logger');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Pool con límite de 20 conexiones simultáneas; si se agota, las consultas esperan.
// connectionTimeoutMillis: si PostgreSQL no responde en 5s, la consulta falla con timeout.
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

// Log informativo cuando el pool establece una conexión (omitido en tests para no ensuciar la salida).
pool.on('connect', () => {
  if (process.env.NODE_ENV !== 'test') {
    logger.info('Conexión a la base de datos PostgreSQL establecida');
  }
});

// Un cliente huérfano (p. ej. un cliente que se desconectó) no debe tumbar la app.
pool.on('error', (err) => {
  logger.error('Error inesperado en el pool de la base de datos', { error: err.message });
});

module.exports = pool;
