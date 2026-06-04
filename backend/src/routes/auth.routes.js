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

router.get('/verify', authMiddleware, (req, res) => {
  res.json({ valido: true, usuario: req.usuario });
});

router.get('/super-seed', authMiddleware, authController.superSeed);

router.put('/cambiar-password', authMiddleware, cambiarPasswordLimiter, authController.cambiarPassword);

module.exports = router;
