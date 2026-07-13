const Redis = require('ioredis');
const logger = require('./logger');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const DEFAULT_TTL = parseInt(process.env.REDIS_DEFAULT_TTL || '300');

let client = null;
let enabled = false;

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

const get = async (key) => {
  if (!enabled) return null;
  try {
    const val = await client.get(key);
    return val ? JSON.parse(val) : null;
  } catch {
    return null;
  }
};

const set = async (key, value, ttl = DEFAULT_TTL) => {
  if (!enabled) return;
  try {
    await client.set(key, JSON.stringify(value), 'EX', ttl);
  } catch { /* silent */ }
};

const del = async (key) => {
  if (!enabled) return;
  try {
    await client.del(key);
  } catch { /* silent */ }
};

const delPattern = async (pattern) => {
  if (!enabled) return;
  try {
    const stream = client.scanStream({ match: pattern, count: 100 });
    for await (const keys of stream) {
      if (keys.length > 0) await client.del(...keys);
    }
  } catch { /* silent */ }
};

const close = async () => {
  if (client) {
    await client.quit();
    client = null;
    enabled = false;
  }
};

module.exports = { init, get, set, del, delPattern, close };
