const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const authMiddleware = require('../middleware/auth');

// Todas las rutas require token
router.use(authMiddleware);

// SEDES
router.get('/sedes', adminController.getSedes);

// SERVICIOS
router.get('/servicios', adminController.getServicios);
router.post('/servicios', adminController.crearServicio);
router.put('/servicios/:id', adminController.actualizarServicio);
router.delete('/servicios/:id', adminController.eliminarServicio);

// CONSULTORIOS
router.get('/consultorios', adminController.getConsultorios);
router.post('/consultorios', adminController.crearConsultorio);
router.put('/consultorios/:id', adminController.actualizarConsultorio);
router.delete('/consultorios/:id', adminController.eliminarConsultorio);

// PERSONAL
router.get('/personal', adminController.getPersonal);
router.post('/personal', adminController.crearPersonal);
router.put('/personal/:id', adminController.actualizarPersonal);
router.delete('/personal/:id', adminController.eliminarPersonal);

// REPORTES
router.get('/reportes/diario', adminController.getReporteDiario);
router.get('/reportes/avanzadas', adminController.getEstadisticasAvanzadas);

// SISTEMA
router.post('/sistema/cerrar', adminController.cerrarSistema);

module.exports = router;
