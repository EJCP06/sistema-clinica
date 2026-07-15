/**
 * Obtiene el ID del usuario autenticado desde el token JWT.
 *
 * @param {import('express').Request} req - Petición HTTP
 * @returns {number|undefined} ID del usuario
 */
const getUserId = (req) => req.usuario?.id;

/**
 * Obtiene el ID de sede del usuario autenticado desde el token JWT.
 * Si no está presente, responde con 401 automáticamente.
 *
 * @param {import('express').Request} req - Petición HTTP
 * @param {import('express').Response} [res] - Respuesta HTTP (opcional, para error 401)
 * @returns {number|null} ID de sede o null si no está disponible
 */
const getSede = (req, res) => {
  const sede = req.usuario?.id_sede;
  const rol = req.usuario?.rol;
  if (sede === undefined || sede === null) {
    if (res) res.status(401).json({ mensaje: 'Token inválido o sin sede' });
    return null;
  }
  return Number(sede);
};

module.exports = { getUserId, getSede };
