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
const { contexto } = require('./contexto-usuario');

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

// ====================================================================
// AUDITORÍA: quién escribió cada fila
// --------------------------------------------------------------------
// Antes de cada consulta se fija en la sesión de PostgreSQL la variable
// 'app.usuario' con el nombre del usuario autenticado (contexto-usuario.js).
// El trigger fn_auditoria_registro() la lee para rellenar usuario_creacion y
// usuario_modificacion. Como cada consulta usa su propio cliente del pool y
// el valor se captura al llamar, dos peticiones simultáneas no se mezclan.
// ====================================================================
const connectOriginal = pool.connect.bind(pool);

// Último usuario fijado en cada conexión (para no repetir el SET en cada query).
const usuarioPorConexion = new WeakMap();

/**
 * Fija 'app.usuario' en la sesión del cliente indicado si cambió respecto a
 * la última vez que se usó esa conexión.
 *
 * @param {import('pg').PoolClient} client - Conexión que ejecutará la consulta
 * @returns {Promise<void>}
 */
const fijarUsuarioEnConexion = async (client) => {
  const nombre = contexto.getStore()?.nombre || '';
  if ((usuarioPorConexion.get(client) || '') === nombre) return;
  await client.query(`SELECT set_config('app.usuario', $1, false)`, [nombre]);
  usuarioPorConexion.set(client, nombre);
};

// pool.query(...): se obtiene una conexión, se marca el usuario y se ejecuta.
pool.query = async (...args) => {
  const client = await connectOriginal();
  try {
    await fijarUsuarioEnConexion(client);
    return await client.query(...args);
  } finally {
    client.release();
  }
};

// pool.connect(): también marca el usuario, para que las transacciones
// (BEGIN ... COMMIT) conserven el usuario durante toda la transacción.
pool.connect = async (...args) => {
  const client = await connectOriginal(...args);
  try {
    await fijarUsuarioEnConexion(client);
  } catch (err) {
    // No se rompe la petición: la escritura queda como 'SISTEMA'.
    logger.warn('No se pudo fijar app.usuario en la conexión', { error: err.message });
  }
  return client;
};

module.exports = pool;
