const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const ctrl = require('../controllers/recepcion.controller');
const auth = require('../middleware/auth');
const { permissionMiddleware: perm } = require('../middleware/permission');

const validar = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ mensaje: errors.array()[0].msg });
  next();
};

router.use(auth);

router.get('/ultimas-admisiones', perm(
  'ADMISION_TOTAL',
  'LABORATORIO_TOTAL',
  'IMAGENES_TOTAL'
), ctrl.getUltimasAdmisiones);

router.get('/responsables-pago', perm(
  'ADMISION_TOTAL',
  'LABORATORIO_TOTAL',
  'IMAGENES_TOTAL'
), ctrl.getResponsablesPago);

router.use(perm(
  'ADMISION_TOTAL',
  'LABORATORIO_TOTAL',
  'IMAGENES_TOTAL'
));
router.get('/pacientes/:termino', ctrl.buscarPaciente);
router.post('/pacientes', [
  body('cedula').trim().notEmpty().withMessage('La cédula del paciente es obligatoria'),
  body('primer_nombre').trim().notEmpty().withMessage('El primer nombre es obligatorio'),
  body('primer_apellido').trim().notEmpty().withMessage('El primer apellido es obligatorio'),
  validar,
], ctrl.crearPaciente);
router.put('/pacientes/:id', [
  body('cedula').optional().trim().notEmpty().withMessage('La cédula no puede estar vacía'),
  validar,
], ctrl.actualizarPaciente);
router.delete('/pacientes/:id', ctrl.eliminarPaciente);
router.post('/generar-turno', [
  body('id_paciente').isInt().withMessage('El paciente es obligatorio'),
  body('id_servicio').isInt().withMessage('El servicio es obligatorio'),
  validar,
], ctrl.generarTurno);
router.put('/atencion/:id', [
  body('id_servicio').optional().isInt().withMessage('Servicio inválido'),
  body('id_responsable').optional().isInt().withMessage('Responsable inválido'),
  body('id_especialidad').optional({ values: 'null' }).isInt().withMessage('Especialidad inválida'),
  validar,
], ctrl.actualizarAtencion);
router.put('/atencion/:id/estado', [
  body('id_estado_nuevo').isInt({ min: 1, max: 9 }).withMessage('Estado inválido'),
  validar,
], ctrl.actualizarEstadoAtencion);
router.delete('/atencion/:id', ctrl.eliminarAtencion);
router.put('/atencion/:id/marcar_ausente', perm('COORDINADOR_AYUDA', 'LABORATORIO_TOTAL', 'IMAGENES_TOTAL'), ctrl.marcarAusente);

module.exports = router;