const Redis = require('ioredis');
const logger = require('./logger');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const DEFAULT_TTL = parseInt(process.env.REDIS_DEFAULT_TTL || '300');

let client = null;
let enabled = false;

/**
 * Inicializa la conexión con Redis. Si el servicio no está disponible,
 * desactiva la caché y registra una advertencia en lugar de fallar.
 *
 * @returns {object|null} Instancia de Redis client o null si no disponible
 */
const init = () => {
  if (client) return client;
  try {
    client = new Redis(REDIS_URL, {
      lazyConnect: true,
      retryStrategy: (times) => {
        if (times > 3) return null;
        return Math.min(times * 200, 2000);
      },
    });
    enabled = true;
  } catch (err) {
    logger.warn('Redis no disponible, caché desactivada', { error: err.message });
    enabled = false;
  }
  return client;
};

/**
 * Obtiene un valor de la caché por su clave.
 *
 * @param {string} key - Clave del valor en Redis
 * @returns {Promise<*|null>} Valor deserializado o null si no existe o hay error
 */
const get = async (key) => {
  if (!enabled) return null;
  try {
    const val = await client.get(key);
    return val ? JSON.parse(val) : null;
  } catch {
    return null;
  }
};

/**
 * Almacena un valor en la caché con un TTL determinado.
 *
 * @param {string} key - Clave bajo la cual almacenar
 * @param {*} value - Valor a serializar como JSON
 * @param {number} [ttl=300] - Tiempo de vida en segundos
 * @returns {Promise<void>}
 */
const set = async (key, value, ttl = DEFAULT_TTL) => {
  if (!enabled) return;
  try {
    await client.set(key, JSON.stringify(value), 'EX', ttl);
  } catch { /* noop */ }
};

/**
 * Elimina una entrada específica de la caché.
 *
 * @param {string} key - Clave a eliminar
 * @returns {Promise<void>}
 */
const del = async (key) => {
  if (!enabled) return;
  try {
    await client.del(key);
  } catch { /* noop */ }
};

/**
 * Elimina todas las entradas que coincidan con un patrón glob.
 *
 * @param {string} pattern - Patrón glob (ej. 'turnos:*')
 * @returns {Promise<void>}
 */
const delPattern = async (pattern) => {
  if (!enabled) return;
  try {
    const stream = client.scanStream({ match: pattern, count: 100 });
    for await (const keys of stream) {
      if (keys.length > 0) await client.del(...keys);
    }
  } catch { /* noop */ }
};

/**
 * Cierra la conexión con Redis y desactiva la caché.
 *
 * @returns {Promise<void>}
 */
const close = async () => {
  if (client) {
    await client.quit();
    client = null;
    enabled = false;
  }
};

module.exports = { init, get, set, del, delPattern, close };
