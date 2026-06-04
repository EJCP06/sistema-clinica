const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const login = async (req, res) => {
  const { username, password } = req.body;
  const cedula = username; 

  if (!cedula || !password) {
    return res.status(400).json({ mensaje: 'Por favor proporcione cédula y password' });
  }

  try {
    // 1. Buscar al usuario por cédula
    const result = await pool.query(`
      SELECT u.id_usuario as id, u.cedula, u.password_hash, u.rol, u.nombre, u.apellido,
             u.id_servicio as servicio_id, u.id_consultorio as consultorio_id, u.id_sede,
             u.id_especialidad, e.nombre as especialidad_nombre
      FROM "Usuarios" u
      LEFT JOIN "Especialidades" e ON u.id_especialidad = e.id_especialidad
      WHERE u.cedula = $1
    `, [cedula]);

    if (result.rows.length === 0) {
      return res.status(401).json({ mensaje: 'Usuario inválido' });
    }

    const usuario = result.rows[0];

    // 2. Verificar password
    const esPasswordValido = await bcrypt.compare(password, usuario.password_hash);
    if (!esPasswordValido) {
      return res.status(401).json({ mensaje: 'Contraseña inválida' });
    }

    // 3. Crear Token
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

// Función de emergencia para resetear el admin si nada funciona
const superSeed = async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ mensaje: 'No disponible' });
  }
  try {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('123456', salt);
    
    await pool.query('DELETE FROM "Usuarios" WHERE cedula = $1', ['00000000']);
    await pool.query(
      'INSERT INTO "Usuarios" (password_hash, rol, nombre, apellido, cedula, id_sede, status) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [hash, 'admin', 'ADMIN', 'SISTEMA', '00000000', 1, true]
    );
    
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
    const result = await pool.query('SELECT id_usuario FROM "Usuarios" WHERE cedula = $1', [cedula]);
    if (result.rows.length === 0) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    const password_hash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE "Usuarios" SET password_hash = $1 WHERE cedula = $2', [password_hash, cedula]);

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
