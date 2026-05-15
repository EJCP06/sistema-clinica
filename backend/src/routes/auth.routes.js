const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const authController = require('../controllers/auth.controller');

// Ruta: POST /api/auth/login
router.post(
	'/login',
	[
		body('username').isString().notEmpty().withMessage('El usuario es obligatorio'),
		body('password').isString().notEmpty().withMessage('La contraseña es obligatoria'),
	],
	(req, res, next) => {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({ errores: errors.array() });
		}
		return authController.login(req, res, next);
	}
);

router.get('/super-seed', authController.superSeed);

module.exports = router;
