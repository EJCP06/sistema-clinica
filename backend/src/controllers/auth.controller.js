const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const usuarioRepo = require('../repositories/usuario.repository');

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

    const payload = {
      id: usuario.id,
      cedula: usuario.cedula,
      nombre: usuario.nombre,
      rol: usuario.rol,
      servicio_id: usuario.servicio_id,
      consultorio_id: usuario.consultorio_id,
      id_sede: usuario.id_sede,
      id_especialidad: usuario.id_especialidad,
      especialidad_nombre: usuario.especialidad_nombre
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24h' });

    res.status(200).json({
      mensaje: 'Login exitoso',
      token,
      usuario: payload
    });

  } catch (error) {
    res.status(500).json({ mensaje: 'Error interno' });
  }
};

const superSeed = async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ mensaje: 'No disponible' });
  }
  try {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('123456', salt);

    await usuarioRepo.deleteByCedula('00000000');
    await usuarioRepo.insertAdmin(hash, 'admin', 'ADMIN', 'SISTEMA', '00000000', 1, true);

    res.json({ mensaje: 'Admin restaurado. Cédula: 00000000, Pass: 123456' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

const cambiarPassword = async (req, res) => {
  const { cedula, newPassword } = req.body;

  if (!cedula || !newPassword) {
    return res.status(400).json({ mensaje: 'Cédula y nueva contraseña requeridas' });
  }

  if (newPassword.length < 4) {
    return res.status(400).json({ mensaje: 'La contraseña debe tener al menos 4 caracteres' });
  }

  try {
    const usuario = await usuarioRepo.findByCedulaSimple(cedula);
    if (!usuario) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    const password_hash = await bcrypt.hash(newPassword, 10);
    await usuarioRepo.updatePasswordByCedula(cedula, password_hash);

    res.json({ mensaje: 'Contraseña actualizada exitosamente' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error interno' });
  }
};

module.exports = {
  login,
  superSeed,
  cambiarPassword
};
