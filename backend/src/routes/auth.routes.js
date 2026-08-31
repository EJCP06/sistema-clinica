/**
 * Rutas de autenticación (módulo público).
 *
 * - POST /login               -> Inicio de sesión (protegido por loginLimiter)
 * - POST /seleccionar-especialidad -> Elige con cuál especialidad entra el médico
 * - POST /refresh             -> Renovación de access token vía refresh token
 * - POST /logout              -> Cierre de sesión
 * - GET  /verify              -> Valida si la sesión actual sigue siendo válida
 * - GET  /mis-permisos        -> Permisos del usuario autenticado
 * - PUT  /cambiar-password    -> Cambio de contraseña
 *
 * Nota: el limiter de login se aplica en backend/index.js (ver rateLimiter.js).
 */
const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middleware/auth');

const validar = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ mensaje: errors.array()[0].msg });
  next();
};

router.post('/login', [
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

router.post('/seleccionar-especialidad', authMiddleware, authController.seleccionarEspecialidad);
router.post('/seleccionar-rol', authMiddleware, authController.seleccionarRol);
router.post('/refresh', authController.refrescarToken);
router.put('/cambiar-password', authMiddleware, [
  body('newPassword').isLength({ min: 8 }).withMessage('La nueva contraseña debe tener al menos 8 caracteres'),
  validar,
], authController.cambiarPassword);

router.get('/mis-permisos', authMiddleware, authController.misPermisos);

router.post('/logout', authMiddleware, authController.cerrarSesion);

module.exports = router;
