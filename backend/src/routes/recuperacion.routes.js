const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const recuperacionController = require('../controllers/recuperacion.controller');

const validar = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ mensaje: errors.array()[0].msg });
  next();
};

const solicitarLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { mensaje: 'Demasiadas solicitudes. Intente de nuevo en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const verificarLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { mensaje: 'Demasiados intentos de verificación. Intente de nuevo en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const restablecerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { mensaje: 'Demasiados intentos. Intente de nuevo en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/solicitar', solicitarLimiter, [
  body('email').isEmail().withMessage('Correo inválido'),
  body('cedula').trim().notEmpty().withMessage('Cédula requerida'),
  validar,
], recuperacionController.solicitar);
router.post('/verificar', verificarLimiter, [
  body('email').isEmail().withMessage('Correo inválido'),
  body('cedula').trim().notEmpty().withMessage('Cédula requerida'),
  body('codigo').trim().isLength({ min: 6, max: 6 }).withMessage('Código inválido'),
  validar,
], recuperacionController.verificar);
router.post('/restablecer', restablecerLimiter, [
  body('email').isEmail().withMessage('Correo inválido'),
  body('cedula').trim().notEmpty().withMessage('Cédula requerida'),
  body('codigo').trim().isLength({ min: 6, max: 6 }).withMessage('Código inválido'),
  body('newPassword').isLength({ min: 4 }).withMessage('La contraseña debe tener al menos 4 caracteres'),
  validar,
], recuperacionController.restablecer);

module.exports = router;
