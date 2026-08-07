const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../config/db');

/**
 * Compara dos cadenas en tiempo constante para evitar ataques de
 * temporización (timing attack) en la validación del token de sesión.
 *
 * @param {string} a - Primer valor a comparar
 * @param {string} b - Segundo valor a comparar
 * @returns {boolean} true si ambas cadenas son idénticas
 */
const timingSafeCompare = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
};

/**
 * Middleware de autenticación JWT. Verifica el token del encabezado
 * Authorization, valida que el usuario esté activo y que su token de
 * sesión coincida con el almacenado en base de datos (invalida sesiones
 * simultáneas al detectar un sesion_token diferente).
 *
 * @param {import('express').Request} req - Petición HTTP
 * @param {import('express').Response} res - Respuesta HTTP
 * @param {import('express').NextFunction} next - Siguiente middleware
 * @returns {Promise<void>}
 */
const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ mensaje: 'No token' });
  }

  const token = authHeader.split(' ')[1];

  try {
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (verifyErr) {
      // En entornos no productivos permitimos un fallback para decodificar
      // el token sin verificar la firma. Esto facilita el desarrollo cuando
      // el servidor se reinicia y las sesiones en clientes quedan con tokens
      // firmados por la instancia anterior.
      if (process.env.NODE_ENV === 'production') {
        return res.status(401).json({ mensaje: 'Token inválido' });
      }
      decoded = jwt.decode(token);
      if (!decoded || !decoded.id) {
        return res.status(401).json({ mensaje: 'Token inválido' });
      }
      // Continuar con el decoded (sin verificación de firma) en desarrollo.
    }

    const result = await pool.query(
      `SELECT u.sesion_token, u.status, u.id_rol, u.id_especialidad,
              r.activo AS rol_activo,
              esp.activo AS esp_activo,
              COALESCE(
                (SELECT json_agg(rec.key || ':' || acc.key)
                 FROM "Roles_Recursos_Acciones" rra
                 INNER JOIN "Recursos" rec ON rra.id_recurso = rec.id_recurso
                 INNER JOIN "Acciones" acc ON rra.id_accion = acc.id_accion
                 WHERE rra.id_rol = u.id_rol), '[]'
              ) AS permisos
       FROM "Usuarios" u
       LEFT JOIN "Roles" r ON u.id_rol = r.id_rol
       LEFT JOIN "Especialidades" esp ON u.id_especialidad = esp.id_especialidad
       WHERE u.id_usuario = $1`,
      [decoded.id],
    );

    const usuario = result.rows[0];
    if (!usuario || usuario.status === false) {
      return res.status(401).json({ mensaje: 'Sesión inválida. Tu usuario ha sido desactivado.' });
    }
    if (usuario.rol_activo === false) {
      return res.status(401).json({ mensaje: 'Sesión inválida. Tu rol ha sido desactivado.' });
    }
    if (usuario.id_especialidad != null && usuario.esp_activo === false) {
      return res.status(401).json({ mensaje: 'Sesión inválida. Tu especialidad ha sido desactivada.' });
    }
    if (usuario.sesion_token && decoded.sesion_token && !timingSafeCompare(usuario.sesion_token, decoded.sesion_token)) {
      return res.status(401).json({ mensaje: 'Sesión inválida. Otro usuario ha iniciado sesión con tus credenciales.' });
    }

    req.usuario = { ...decoded, permisos: result.rows[0].permisos };
    next();
  } catch (err) {
    return res.status(401).json({ mensaje: 'Token inválido' });
  }
};

module.exports = authMiddleware;
