const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const ctrl = require('../controllers/recepcion.controller');
const auth = require('../middleware/auth');
const role = require('../middleware/roles');

const validar = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ mensaje: errors.array()[0].msg });
  next();
};

router.use(auth);
router.use(role('recepcionista', 'administrador', 'coordinador', 'analista', 'laboratorio', 'imagenes'));

router.get('/responsables-pago', ctrl.getResponsablesPago);
router.get('/ultimas-admisiones', ctrl.getUltimasAdmisiones);
router.get('/pacientes/:termino', ctrl.buscarPaciente);
router.post('/pacientes', [
  body('nombre').trim().notEmpty().withMessage('El nombre del paciente es obligatorio'),
  body('apellido').trim().notEmpty().withMessage('El apellido del paciente es obligatorio'),
  body('cedula').trim().notEmpty().withMessage('La cédula del paciente es obligatoria'),
  validar,
], ctrl.crearPaciente);
router.put('/pacientes/:id', ctrl.actualizarPaciente);
router.delete('/pacientes/:id', ctrl.eliminarPaciente);
router.post('/generar-turno', [
  body('id_paciente').isInt().withMessage('El paciente es obligatorio'),
  body('id_servicio').isInt().withMessage('El servicio es obligatorio'),
  validar,
], ctrl.generarTurno);
router.put('/atencion/:id', ctrl.actualizarAtencion);
router.put('/atencion/:id/estado', ctrl.actualizarEstadoAtencion);
router.delete('/atencion/:id', ctrl.eliminarAtencion);

module.exports = router;
