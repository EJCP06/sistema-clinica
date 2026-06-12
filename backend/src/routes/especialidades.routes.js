const express = require('express');
const { body, param, validationResult } = require('express-validator');
const router = express.Router();
const espController = require('../controllers/especialidades.controller');
const { getEspecialidades, createEspecialidad, updateEspecialidad, deleteEspecialidad } = espController;
const auth = require('../middleware/auth');
const perm = require('../middleware/permission');

const validar = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ mensaje: errors.array()[0].msg });
  next();
};

router.get('/', auth, perm('especialidades_crear', 'especialidades_editar', 'especialidades_eliminar'), getEspecialidades);
router.post('/', auth, perm('especialidades_crear'), [
  body('nombre').trim().notEmpty().withMessage('El nombre es obligatorio'),
  body('id_servicio').isInt().withMessage('El servicio es obligatorio'),
  validar,
], createEspecialidad);
router.put('/:id', auth, perm('especialidades_editar'), [
  param('id').isInt().withMessage('ID inválido'),
  validar,
], updateEspecialidad);
router.delete('/:id', auth, perm('especialidades_eliminar'), [
  param('id').isInt().withMessage('ID inválido'),
  validar,
], deleteEspecialidad);

router.post('/importar', auth, perm('especialidades_crear'), espController.importarEspecialidades);

module.exports = router;
