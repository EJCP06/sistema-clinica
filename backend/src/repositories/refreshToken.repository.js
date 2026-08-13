/**
 * Repositorio de refresh tokens (sesiones de larga duración).
 *
 * Seguridad: en la base de datos SOLO se guarda el hash SHA-256 del token,
 * nunca el token en texto plano. El token crudo se devuelve una sola vez al
 * cliente (al iniciar sesión) y se almacena del lado del navegador.
 *
 * Columnas relevantes: revocado (invalida sesiones) y expira (NULL = sin expiración,
 * ver migración 014_refresh_token_sin_expiracion.sql).
 */
const crypto = require('crypto');
const pool = require('../config/db');

/**
 * Genera un token aleatorio de 48 bytes, guarda su hash y devuelve el token crudo.
 *
 * @param {number} userId - ID del usuario dueño de la sesión
 * @returns {Promise<string>} Token crudo que se entrega al cliente
 */
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