const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

// Ruta: POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ mensaje: 'Usuario y contraseña requeridos' });
  }
  return authController.login(req, res);
});

router.get('/super-seed', authController.superSeed);

module.exports = router;
