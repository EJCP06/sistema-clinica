const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middleware/auth');

const validar = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ mensaje: errors.array()[0].msg });
  next();
};

// Rate limiting: max 10 login attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { mensaje: 'Demasiados intentos de inicio de sesión. Intente de nuevo en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const cambiarPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { mensaje: 'Demasiados intentos. Intente de nuevo en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Ruta: POST /api/auth/login
router.post('/login', loginLimiter, [
  body('username').trim().notEmpty().withMessage('Usuario requerido'),
  body('password').notEmpty().withMessage('Contraseña requerida'),
  validar,
], (req, res) => {
  return authController.login(req, res);
});

router.get('/verify', authMiddleware, async (req, res) => {
  try {
    const pool = require('../config/db');
    const result = await pool.query(
      `SELECT u.primer_nombre AS nombre, u.primer_apellido AS apellido,
              u.id_usuario as id, u.cedula, r.key as rol,
              u.id_servicio as servicio_id, u.id_consultorio as consultorio_id, u.id_sede,
              u.id_especialidad, e.nombre as especialidad_nombre,
              COALESCE(
                (SELECT json_agg(rec.key || ':' || acc.key)
                 FROM "Roles_Recursos_Acciones" rra
                 INNER JOIN "Recursos" rec ON rra.id_recurso = rec.id_recurso
                 INNER JOIN "Acciones" acc ON rra.id_accion = acc.id_accion
                 WHERE rra.id_rol = u.id_rol), '[]'
              ) AS permisos
       FROM "Usuarios" u
       LEFT JOIN "Especialidades" e ON u.id_especialidad = e.id_especialidad
       INNER JOIN "Roles" r ON u.id_rol = r.id_rol
       WHERE u.id_usuario = $1`,
      [req.usuario.id]
    );
    const usuario = result.rows[0];
    if (!usuario) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }
    res.json({ valido: true, usuario });
  } catch (err) {
    res.status(500).json({ mensaje: 'Error al verificar sesión' });
  }
});

router.post('/refresh', authController.refrescarToken);

router.get('/super-seed', authController.superSeed);

router.put('/cambiar-password', authMiddleware, cambiarPasswordLimiter, [
  body('newPassword').isLength({ min: 4 }).withMessage('La nueva contraseña debe tener al menos 4 caracteres'),
  validar,
], authController.cambiarPassword);

router.get('/mis-permisos', authMiddleware, authController.misPermisos);

router.post('/logout', authMiddleware, authController.cerrarSesion);

module.exports = router;
