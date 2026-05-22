const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const login = async (req, res) => {
  const { username, password } = req.body; // El campo del input se llama username en el payload de Angular pero contiene la cedula
  const cedula = username; 

  if (!cedula || !password) {
    return res.status(400).json({ mensaje: 'Por favor proporcione cédula y password' });
  }

  try {
    console.log('Intento de login con cédula:', cedula);
    
    // 1. Buscar al usuario por cédula
    const result = await pool.query(`
      SELECT id_usuario as id, cedula, password_hash, rol, nombre, apellido, id_servicio as servicio_id, id_consultorio as consultorio_id, id_sede 
      FROM "Usuarios" 
      WHERE cedula = $1
    `, [cedula]);

    if (result.rows.length === 0) {
      console.log('Usuario no encontrado en DB:', cedula);
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
      id_sede: usuario.id_sede
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET || 'clinica-secret-key', { expiresIn: '24h' });

    res.status(200).json({
      mensaje: 'Login exitoso',
      token,
      usuario: payload
    });

  } catch (error) {
    console.error('Error login:', error);
    res.status(500).json({ mensaje: 'Error interno' });
  }
};

// Función de emergencia para resetear el admin si nada funciona
const superSeed = async (req, res) => {
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
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  login,
  superSeed
};
