/**
 * Rutas de gestión de turnos (crear, marcar ausente, reincorporar).
 *
 * Accesible para cualquier módulo operativo (admisión, laboratorio, imágenes,
 * atención médica) porque todos generan o gestionan turnos. Requiere JWT y
 * cualquiera de los conjuntos de permisos indicados.
 */
const express = require('express');
const { body, param, validationResult } = require('express-validator');
const router = express.Router();
const turnosController = require('../controllers/turnos.controller');
const auth = require('../middleware/auth');
const { permissionMiddleware: perm } = require('../middleware/permission');

const validar = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ mensaje: errors.array()[0].msg });
  next();
};

router.use(auth);
router.use(perm(
  'ADMISION_TOTAL',
  'LABORATORIO_TOTAL',
  'IMAGENES_TOTAL',
  'ATENCION_MEDICA_TOTAL'
));

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
