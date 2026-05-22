const express = require('express');
const router = express.Router();

// AJUSTA ESTA RUTA SEGÚN TU PROYECTO
const sharedController = require('../controllers/shared.controller');

// VALIDACIÓN (esto evita el crash silencioso)
if (!sharedController) {
  throw new Error('sharedController no está siendo importado correctamente');
}

router.get('/salud', (req, res) => {
  res.json({ ok: true, mensaje: 'shared routes funcionando' });
});

module.exports = router;
