const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const sharedController = require('../controllers/shared.controller');
const auth = require('../middleware/auth');
const role = require('../middleware/roles');

const validar = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ mensaje: errors.array()[0].msg });
  next();
};

router.use(auth);
router.use(role('recepcionista', 'administrador', 'coordinador', 'analista'));

router.get('/aseguradoras', sharedController.getAseguradoras);
router.post('/aseguradoras', [
  body('nombre').trim().notEmpty().withMessage('El nombre de la aseguradora es obligatorio'),
  validar,
], sharedController.crearAseguradora);
router.post('/aseguradoras/importar', sharedController.importarAseguradoras);

module.exports = router;
