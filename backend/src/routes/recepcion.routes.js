const express = require('express');
const router = express.Router();
const recepcionController = require('../controllers/recepcion.controller');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// Rutas de Pacientes
router.get('/pacientes/:cedula', recepcionController.buscarPaciente);
router.post('/pacientes', recepcionController.crearPaciente);

// Rutas de Configuración para Recepción
router.get('/responsables-pago', recepcionController.getResponsablesPago);

// Registro de Atención
router.post('/atencion', recepcionController.registrarAtencion);
router.post('/generar-turno', recepcionController.registrarAtencion); // Alias for frontend
router.put('/atencion/:id_atencion/estado', recepcionController.actualizarEstadoAtencion);

// Últimas Admisiones
router.get('/ultimas-admisiones', recepcionController.getUltimasAdmisiones);

// Ruta Pública para Sala de Espera
router.get('/sala-espera', recepcionController.getTurnosSalaEspera);

module.exports = router;
