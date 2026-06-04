const express = require('express');
const { body, param, validationResult } = require('express-validator');
const router = express.Router();
const turnosController = require('../controllers/turnos.controller');
const auth = require('../middleware/auth');
const role = require('../middleware/roles');

const validar = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ mensaje: errors.array()[0].msg });
  next();
};

router.use(auth);
router.use(role('medico', 'recepcionista', 'admin', 'laboratorio', 'imagenes', 'aps'));

router.get('/', turnosController.getTodosLosTurnos);
router.get('/todos', turnosController.getTodosLosTurnos);
router.post('/', [
  body('id_paciente').isInt().withMessage('El paciente es obligatorio'),
  body('id_servicio').isInt().withMessage('El servicio es obligatorio'),
  validar,
], turnosController.crearTurno);
router.put('/:id/ausente', [
  param('id').isInt().withMessage('ID inválido'),
  validar,
], turnosController.marcarAusente);
router.put('/:id/reincorporar', [
  param('id').isInt().withMessage('ID inválido'),
  validar,
], turnosController.reincorporarPaciente);

module.exports = router;
