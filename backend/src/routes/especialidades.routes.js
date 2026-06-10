const express = require('express');
const { body, param, validationResult } = require('express-validator');
const router = express.Router();
const espController = require('../controllers/especialidades.controller');
const { getEspecialidades, createEspecialidad, updateEspecialidad, deleteEspecialidad } = espController;
const auth = require('../middleware/auth');
const role = require('../middleware/roles');

const validar = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ mensaje: errors.array()[0].msg });
  next();
};

router.get('/', auth, role('administrador', 'medico', 'recepcionista', 'coordinador', 'analista'), getEspecialidades);
router.post('/', auth, role('administrador'), [
  body('nombre').trim().notEmpty().withMessage('El nombre es obligatorio'),
  body('id_servicio').isInt().withMessage('El servicio es obligatorio'),
  validar,
], createEspecialidad);
router.put('/:id', auth, role('administrador'), [
  param('id').isInt().withMessage('ID inválido'),
  validar,
], updateEspecialidad);
router.delete('/:id', auth, role('administrador'), [
  param('id').isInt().withMessage('ID inválido'),
  validar,
], deleteEspecialidad);

router.post('/importar', auth, role('administrador'), espController.importarEspecialidades);

module.exports = router;
