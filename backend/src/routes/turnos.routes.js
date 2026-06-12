const express = require('express');
const { body, param, validationResult } = require('express-validator');
const router = express.Router();
const turnosController = require('../controllers/turnos.controller');
const auth = require('../middleware/auth');
const perm = require('../middleware/permission');

const validar = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ mensaje: errors.array()[0].msg });
  next();
};

router.use(auth);
router.use(perm('admision_crear', 'admision_asignar_turno', 'atencion_medica_llamar_siguiente', 'atencion_medica_liberar_consultorio', 'laboratorio_registrar_caja', 'laboratorio_pasar_sala_espera', 'laboratorio_marcar_ausente', 'laboratorio_reincorporar', 'imagenes_registrar_caja', 'imagenes_pasar_sala_espera', 'imagenes_marcar_ausente', 'imagenes_reincorporar'));

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
