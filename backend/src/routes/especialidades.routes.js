const express = require('express');
const { body, param, validationResult } = require('express-validator');
const router = express.Router();
const { getEspecialidades, createEspecialidad, updateEspecialidad, deleteEspecialidad } = require('../controllers/especialidades.controller');
const auth = require('../middleware/auth');
const role = require('../middleware/roles');

const validar = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ mensaje: errors.array()[0].msg });
  next();
};

router.get('/', auth, role('admin', 'medico', 'recepcionista'), getEspecialidades);
router.post('/', auth, role('admin'), [
  body('nombre').trim().notEmpty().withMessage('El nombre es obligatorio'),
  body('id_servicio').isInt().withMessage('El servicio es obligatorio'),
  validar,
], createEspecialidad);
router.put('/:id', auth, role('admin'), [
  param('id').isInt().withMessage('ID inválido'),
  validar,
], updateEspecialidad);
router.delete('/:id', auth, role('admin'), [
  param('id').isInt().withMessage('ID inválido'),
  validar,
], deleteEspecialidad);

module.exports = router;
