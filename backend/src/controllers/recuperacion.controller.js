const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { enviarCorreoOTP } = require('../config/email');
const recuperacionRepo = require('../repositories/recuperacion.repository');
const usuarioRepo = require('../repositories/usuario.repository');

const solicitar = async (req, res) => {
  const { email, cedula } = req.body;

  if (!email || !cedula) {
    return res.status(400).json({ mensaje: 'Correo y cédula son requeridos' });
  }

  try {
    const usuario = await recuperacionRepo.findUsuarioByEmailYCedula(email, cedula);

    if (!usuario) {
      return res.status(200).json({ mensaje: 'Si el correo y cédula están registrados, recibirás un código de verificación', expiracion: 180 });
    }

    const codigo = crypto.randomInt(100000, 999999).toString();
    const codigoHash = await bcrypt.hash(codigo, 10);

    await recuperacionRepo.invalidarCodigosPendientes(usuario.id_usuario);
    await recuperacionRepo.insertarCodigo(usuario.id_usuario, codigoHash);

    try {
      await enviarCorreoOTP(usuario.email, codigo);
    } catch (emailError) {
      return res.status(500).json({ mensaje: 'Error al enviar el correo. Verifica la configuración de email.' });
    }

    res.json({ mensaje: 'Código enviado al correo registrado', expiracion: 180 });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error interno' });
  }
};

const verificar = async (req, res) => {
  const { email, cedula, codigo } = req.body;

  if (!email || !cedula || !codigo) {
    return res.status(400).json({ mensaje: 'Correo, cédula y código son requeridos' });
  }

  try {
    const registro = await recuperacionRepo.findCodigoValido(email, cedula);

    if (!registro) {
      return res.status(400).json({ mensaje: 'No hay código pendiente. Solicita uno nuevo.' });
    }

    if (new Date() > new Date(registro.expiracion)) {
      await recuperacionRepo.marcarUsado(registro.id_recuperacion);
      return res.status(400).json({ mensaje: 'El código ha expirado. Solicita uno nuevo.' });
    }

    const codigoValido = await bcrypt.compare(codigo, registro.codigo);
    if (!codigoValido) {
      await recuperacionRepo.incrementarIntentos(registro.id_recuperacion);
      return res.status(400).json({ mensaje: 'Código incorrecto' });
    }

    res.json({ mensaje: 'Código verificado correctamente' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error interno' });
  }
};

const restablecer = async (req, res) => {
  const { email, cedula, codigo, newPassword } = req.body;

  if (!email || !cedula || !codigo || !newPassword) {
    return res.status(400).json({ mensaje: 'Todos los campos son requeridos' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ mensaje: 'La contraseña debe tener al menos 8 caracteres' });
  }

  try {
    const registro = await recuperacionRepo.findCodigoValido(email, cedula);

    if (!registro) {
      return res.status(400).json({ mensaje: 'No hay código pendiente. Solicita uno nuevo.' });
    }

    if (new Date() > new Date(registro.expiracion)) {
      await recuperacionRepo.marcarUsado(registro.id_recuperacion);
      return res.status(400).json({ mensaje: 'El código ha expirado. Solicita uno nuevo.' });
    }

    const codigoValido = await bcrypt.compare(codigo, registro.codigo);
    if (!codigoValido) {
      return res.status(400).json({ mensaje: 'Código incorrecto' });
    }

    const password_hash = await bcrypt.hash(newPassword, 10);
    await recuperacionRepo.updatePassword(cedula, password_hash);
    await recuperacionRepo.marcarUsado(registro.id_recuperacion);

    res.json({ mensaje: 'Contraseña actualizada exitosamente' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error interno' });
  }
};

module.exports = { solicitar, verificar, restablecer };
