const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/recepcion.controller');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/responsables-pago', ctrl.getResponsablesPago);
router.get('/ultimas-admisiones', ctrl.getUltimasAdmisiones);
router.get('/pacientes/:cedula', ctrl.buscarPaciente);
router.post('/pacientes', ctrl.crearPaciente);
router.put('/pacientes/:id', ctrl.actualizarPaciente);
router.delete('/pacientes/:id', ctrl.eliminarPaciente);
router.post('/generar-turno', ctrl.generarTurno);
router.put('/atencion/:id', ctrl.actualizarAtencion);
router.put('/atencion/:id/estado', ctrl.actualizarEstadoAtencion);
router.delete('/atencion/:id', ctrl.eliminarAtencion);

module.exports = router;
