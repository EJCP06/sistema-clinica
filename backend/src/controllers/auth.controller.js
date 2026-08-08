const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const usuarioRepo = require('../repositories/usuario.repository');
const refreshTokenRepo = require('../repositories/refreshToken.repository');
const { auditar } = require('../middleware/audit');
const { logErrorSafe } = require('../utils/sanitize');

const ACCESS_TOKEN_EXPIRY = '24h';

const isProduction = process.env.NODE_ENV === 'production';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax',
  path: '/api/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

/**
 * Inicia sesión con cédula y contraseña. Verifica credenciales, estado
 * del usuario, sesiones activas por Socket.IO y emite tokens JWT
 * (access token en body, refresh token en cookie httpOnly).
 *
 * @param {import('express').Request} req - Petición HTTP
 * @param {import('express').Response} res - Respuesta HTTP
 * @returns {Promise<void>}
 */
const login = async (req, res) => {
  const { username, password, force } = req.body;
  const cedula = username; 

  if (!cedula || !password) {
    return res.status(400).json({ mensaje: 'Por favor proporcione cédula y password' });
  }

  try {
    const usuario = await usuarioRepo.findByCedula(cedula);

    if (!usuario) {
      return res.status(401).json({ mensaje: 'Usuario inválido' });
    }

    const esPasswordValido = await bcrypt.compare(password, usuario.password_hash);
    if (!esPasswordValido) {
      return res.status(401).json({ mensaje: 'Contraseña inválida' });
    }

    if (usuario.status === false) {
      return res.status(403).json({ mensaje: 'Su usuario se encuentra inactivo. Contacte al administrador.' });
    }

    if (usuario.rol_activo === false) {
      return res.status(403).json({ mensaje: 'Su rol se encuentra inactivo. Contacte al administrador.' });
    }

    if (usuario.id_especialidad != null && usuario.esp_activo === false) {
      return res.status(403).json({ mensaje: 'Su especialidad se encuentra inactiva. Contacte al administrador.' });
    }

    // Desconectar sockets previos del mismo usuario — el último login siempre gana
    let socketsPrevios = [];
    try {
      const sockets = await Promise.race([
        req.io.fetchSockets(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
      ]);
      for (const socket of sockets) {
        if (socket.usuario && Number(socket.usuario.id) === Number(usuario.id)) {
          socketsPrevios.push(socket);
        }
      }
    } catch {
      /* Si fetchSockets falla o tarda más de 3s, continuar igual */
    }

    const sesionToken = crypto.randomUUID();
    await usuarioRepo.actualizarSesionToken(usuario.id, sesionToken);

    let permisosArr;
    try {
      permisosArr = Array.isArray(usuario.permisos) ? usuario.permisos : (usuario.permisos ? JSON.parse(usuario.permisos) : []);
    } catch (e) {
      permisosArr = [];
    }

    const payload = {
      id: usuario.id,
      id_rol: usuario.id_rol,
      cedula: usuario.cedula,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      rol: usuario.rol,
      permisos: permisosArr,
      servicio_id: usuario.servicio_id,
      consultorio_id: usuario.consultorio_id,
      id_sede: usuario.id_sede,
      id_especialidad: usuario.id_especialidad,
      especialidad_nombre: usuario.especialidad_nombre,
      sesion_token: sesionToken
    };

    const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
    const refreshToken = await refreshTokenRepo.createRefreshToken(usuario.id);

    res.cookie('refresh_token', refreshToken, COOKIE_OPTIONS);

    auditar({ userId: usuario.id, accion: 'login', recurso: 'auth', ip: req.ip });

    res.status(200).json({
      mensaje: 'Login exitoso',
      token: accessToken,
      expiresIn: 86400,
      usuario: payload
    });

    // Notificar y desconectar sockets viejos DESPUÉS de que el nuevo login ya respondió
    for (const socket of socketsPrevios) {
      socket.disconnect(true);
    }

  } catch (error) {
      res.status(500).json({ mensaje: 'Error interno' });
  }
};

/**
 * Cambia la contraseña del usuario autenticado. Valida la contraseña
 * actual si se proporciona y exige un mínimo de 8 caracteres.
 *
 * @param {import('express').Request} req - Petición HTTP
 * @param {import('express').Response} res - Respuesta HTTP
 * @returns {Promise<void>}
 */
const cambiarPassword = async (req, res) => {
  const { newPassword, currentPassword } = req.body;

  if (!newPassword) {
    return res.status(400).json({ mensaje: 'Nueva contraseña requerida' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ mensaje: 'La contraseña debe tener al menos 8 caracteres' });
  }

  try {
    const usuario = await usuarioRepo.findByCedula(req.usuario.cedula);
    if (!usuario) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    if (currentPassword) {
      const esValida = await bcrypt.compare(currentPassword, usuario.password_hash);
      if (!esValida) {
        return res.status(400).json({ mensaje: 'La contraseña actual no es correcta' });
      }
    }

    if (currentPassword && currentPassword === newPassword) {
      return res.status(400).json({ mensaje: 'La nueva contraseña debe ser diferente a la actual' });
    }

    const password_hash = await bcrypt.hash(newPassword, 10);
    await usuarioRepo.updatePassword(req.usuario.id, password_hash);

    res.json({ mensaje: 'Contraseña actualizada exitosamente' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error interno' });
  }
};

/**
 * Obtiene los permisos del usuario autenticado.
 *
 * @param {import('express').Request} req - Petición HTTP
 * @param {import('express').Response} res - Respuesta HTTP
 * @returns {Promise<void>}
 */
const misPermisos = async (req, res) => {
  try {
    const usuario = await usuarioRepo.findByCedula(req.usuario.cedula);
    if (!usuario) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }
    if (usuario.rol_activo === false) {
      return res.status(403).json({ mensaje: 'Su rol se encuentra inactivo. Contacte al administrador.' });
    }
    if (usuario.id_especialidad != null && usuario.esp_activo === false) {
      return res.status(403).json({ mensaje: 'Su especialidad se encuentra inactiva. Contacte al administrador.' });
    }
    let permisosArr;
    try {
      permisosArr = Array.isArray(usuario.permisos) ? usuario.permisos
        : (usuario.permisos ? JSON.parse(usuario.permisos) : []);
    } catch (e) {
      permisosArr = [];
    }
    res.json({ permisos: permisosArr });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener permisos' });
  }
};

/**
 * Cierra la sesión del usuario: invalida el token de sesión en BD y
 * elimina la cookie refresh_token.
 *
 * @param {import('express').Request} req - Petición HTTP
 * @param {import('express').Response} res - Respuesta HTTP
 * @returns {Promise<void>}
 */
const cerrarSesion = async (req, res) => {
  try {
    await usuarioRepo.actualizarSesionToken(req.usuario.id, null);
    await refreshTokenRepo.revokeAllUserTokens(req.usuario.id);
    res.clearCookie('refresh_token', { ...COOKIE_OPTIONS });

    if (req.io) {
      try {
        const sockets = await req.io.fetchSockets();
        for (const socket of sockets) {
          if (socket.usuario && Number(socket.usuario.id) === Number(req.usuario.id)) {
          socket.emit('sesion-cerrada');
          socket.disconnect(true);
          }
        }
      } catch { /* Ignorar errores de socket */ }
    }

    auditar({ userId: req.usuario.id, accion: 'logout', recurso: 'auth', ip: req.ip });
    res.json({ mensaje: 'Sesión cerrada exitosamente' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al cerrar sesión' });
  }
};

/**
 * Refresca el access token usando un refresh token (vía cookie o body).
 * Invalida el refresh token anterior mediante rotación y emite uno
 * nuevo junto con un nuevo access token.
 *
 * @param {import('express').Request} req - Petición HTTP
 * @param {import('express').Response} res - Respuesta HTTP
 * @returns {Promise<void>}
 */
const refrescarToken = async (req, res) => {
  const refreshToken = req.cookies?.refresh_token || req.body?.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({ mensaje: 'Refresh token requerido' });
  }

  try {
    const record = await refreshTokenRepo.findValidToken(refreshToken);
    if (!record) {
      res.clearCookie('refresh_token', { ...COOKIE_OPTIONS });
      return res.status(401).json({ mensaje: 'Refresh token inválido o expirado' });
    }

    await refreshTokenRepo.revokeToken(refreshToken);

    const usuario = await usuarioRepo.findById(record.id_usuario);
    if (!usuario || usuario.status === false) {
      res.clearCookie('refresh_token', { ...COOKIE_OPTIONS });
      return res.status(401).json({ mensaje: 'Usuario desactivado' });
    }
    if (usuario.rol_activo === false) {
      res.clearCookie('refresh_token', { ...COOKIE_OPTIONS });
      return res.status(401).json({ mensaje: 'Rol desactivado' });
    }
    if (usuario.id_especialidad != null && usuario.esp_activo === false) {
      res.clearCookie('refresh_token', { ...COOKIE_OPTIONS });
      return res.status(401).json({ mensaje: 'Especialidad desactivada' });
    }

    const sesionToken = usuario.sesion_token;

    let permisosArr2;
    try {
      permisosArr2 = Array.isArray(usuario.permisos) ? usuario.permisos : (usuario.permisos ? JSON.parse(usuario.permisos) : []);
    } catch (e) {
      permisosArr2 = [];
    }

    const payload = {
      id: usuario.id,
      id_rol: usuario.id_rol,
      cedula: usuario.cedula,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      rol: usuario.rol,
      permisos: permisosArr2,
      servicio_id: usuario.servicio_id,
      consultorio_id: usuario.consultorio_id,
      id_sede: usuario.id_sede,
      id_especialidad: usuario.id_especialidad,
      especialidad_nombre: usuario.especialidad_nombre,
      sesion_token: sesionToken,
    };

    const newAccessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
    const newRefreshToken = await refreshTokenRepo.createRefreshToken(usuario.id);

    res.cookie('refresh_token', newRefreshToken, COOKIE_OPTIONS);

    res.json({
      token: newAccessToken,
      expiresIn: 86400,
      usuario: payload,
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error interno' });
  }
};

module.exports = {
  login,
  cambiarPassword,
  misPermisos,
  cerrarSesion,
  refrescarToken,
};
