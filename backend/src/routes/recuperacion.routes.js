/**
 * Rutas de recuperación de contraseña (módulo público).
 *
 * Flujo OTP por correo:
 *   1. POST /solicitar   -> valida email+cédula y envía el código
 *   2. POST /verificar   -> valida el código (protegido por otpLimiter)
 *   3. POST /restablecer -> guarda la nueva contraseña
 *
 * 'verificar' y 'restablecer' están limitados a 5 intentos por 15 min por IP
 * (ver backend/src/middleware/rateLimiter.js).
 */
const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const recuperacionController = require('../controllers/recuperacion.controller');
const { otpLimiter } = require('../middleware/rateLimiter');

const validar = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ mensaje: errors.array()[0].msg });
  next();
};

router.post('/solicitar', [
  body('email').isEmail().withMessage('Correo inválido'),
  body('cedula').trim().notEmpty().withMessage('Cédula requerida'),
  validar,
], recuperacionController.solicitar);
router.post('/verificar', otpLimiter, [
  body('email').isEmail().withMessage('Correo inválido'),
  body('cedula').trim().notEmpty().withMessage('Cédula requerida'),
  body('codigo').trim().isLength({ min: 6, max: 6 }).withMessage('Código inválido'),
  validar,
], recuperacionController.verificar);
router.post('/restablecer', otpLimiter, [
  body('email').isEmail().withMessage('Correo inválido'),
  body('cedula').trim().notEmpty().withMessage('Cédula requerida'),
  body('codigo').trim().isLength({ min: 6, max: 6 }).withMessage('Código inválido'),
  body('newPassword').isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres'),
  validar,
], recuperacionController.restablecer);

module.exports = router;
