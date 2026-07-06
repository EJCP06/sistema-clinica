const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const usuarioRepo = require('../repositories/usuario.repository');
const refreshTokenRepo = require('../repositories/refreshToken.repository');
const { auditar } = require('../middleware/audit');

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

const login = async (req, res) => {
  const { username, password } = req.body;
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

    // Verificar si ya existe una sesión activa (a través de WebSocket) para este usuario
    let sesionActiva = false;
    if (req.io && req.io.sockets && req.io.sockets.sockets) {
      for (const socket of req.io.sockets.sockets.values()) {
        if (socket.usuario && Number(socket.usuario.id) === Number(usuario.id)) {
          sesionActiva = true;
          break;
        }
      }
    }

    if (sesionActiva) {
      return res.status(409).json({ mensaje: 'Ya hay un usuario con estas credenciales' });
    }

    const sesionToken = crypto.randomUUID();
    await usuarioRepo.actualizarSesionToken(usuario.id, sesionToken);

    const payload = {
      id: usuario.id,
      id_rol: usuario.id_rol,
      cedula: usuario.cedula,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      rol: usuario.rol,
      permisos: usuario.permisos || [],
      servicio_id: usuario.servicio_id,
      consultorio_id: usuario.consultorio_id,
      id_sede: usuario.id_sede,
      id_especialidad: usuario.id_especialidad,
      especialidad_nombre: usuario.especialidad_nombre,
      sesion_token: sesionToken
    };

    const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
    const refreshToken = await refreshTokenRepo.createRefreshToken(usuario.id);

    auditar({ userId: usuario.id, accion: 'login', recurso: 'auth', ip: req.ip });

    res.status(200).json({
      mensaje: 'Login exitoso',
      token: accessToken,
      refreshToken,
      expiresIn: 900,
      usuario: payload
    });

  } catch (error) {
      res.status(500).json({ mensaje: 'Error interno' });
  }
};

const superSeed = async (req, res) => {
  return res.status(404).json({ mensaje: 'No disponible' });
};

const cambiarPassword = async (req, res) => {
  const { newPassword, currentPassword } = req.body;

  if (!newPassword) {
    return res.status(400).json({ mensaje: 'Nueva contraseña requerida' });
  }

  if (newPassword.length < 4) {
    return res.status(400).json({ mensaje: 'La contraseña debe tener al menos 4 caracteres' });
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

const misPermisos = async (req, res) => {
  try {
    const usuario = await usuarioRepo.findByCedula(req.usuario.cedula);
    if (!usuario) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }
    res.json({ permisos: usuario.permisos || [] });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener permisos' });
  }
};

const cerrarSesion = async (req, res) => {
  try {
    await usuarioRepo.actualizarSesionToken(req.usuario.id, null);
    auditar({ userId: req.usuario.id, accion: 'logout', recurso: 'auth', ip: req.ip });
    res.json({ mensaje: 'Sesión cerrada exitosamente' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al cerrar sesión' });
  }
};

const refrescarToken = async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ mensaje: 'Refresh token requerido' });
  }

  try {
    const record = await refreshTokenRepo.findValidToken(refreshToken);
    if (!record) {
      return res.status(401).json({ mensaje: 'Refresh token inválido o expirado' });
    }

    await refreshTokenRepo.revokeToken(refreshToken);

    const usuario = await usuarioRepo.findById(record.id_usuario);
    if (!usuario || usuario.status === false) {
      return res.status(401).json({ mensaje: 'Usuario desactivado' });
    }

    const sesionToken = crypto.randomUUID();
    await usuarioRepo.actualizarSesionToken(usuario.id, sesionToken);

    const payload = {
      id: usuario.id,
      id_rol: usuario.id_rol,
      cedula: usuario.cedula,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      rol: usuario.rol,
      permisos: usuario.permisos || [],
      servicio_id: usuario.servicio_id,
      consultorio_id: usuario.consultorio_id,
      id_sede: usuario.id_sede,
      id_especialidad: usuario.id_especialidad,
      especialidad_nombre: usuario.especialidad_nombre,
      sesion_token: sesionToken,
    };

    const newAccessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
    const newRefreshToken = await refreshTokenRepo.createRefreshToken(usuario.id);

    res.json({
      token: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: 900,
      usuario: payload,
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error interno' });
  }
};

module.exports = {
  login,
  superSeed,
  cambiarPassword,
  misPermisos,
  cerrarSesion,
  refrescarToken,
};
