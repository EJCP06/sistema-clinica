const crypto = require('crypto');
const pool = require('../config/db');

const createRefreshToken = async (userId) => {
  const raw = crypto.randomBytes(48).toString('hex');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');

  await pool.query(
    'INSERT INTO "Refresh_Tokens" (id_usuario, token_hash, expira) VALUES ($1, $2, NULL)',
    [userId, hash],
  );

  return raw;
};

const findValidToken = async (rawToken) => {
  const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const result = await pool.query(
    'SELECT * FROM "Refresh_Tokens" WHERE token_hash = $1 AND revocado = false',
    [hash],
  );
  return result.rows[0] || null;
};

const revokeToken = async (rawToken) => {
  const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
  await pool.query('UPDATE "Refresh_Tokens" SET revocado = true WHERE token_hash = $1', [hash]);
};

const revokeAllUserTokens = async (userId) => {
  await pool.query('UPDATE "Refresh_Tokens" SET revocado = true WHERE id_usuario = $1', [userId]);
};

module.exports = { createRefreshToken, findValidToken, revokeToken, revokeAllUserTokens };