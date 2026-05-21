const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const authMiddleware = require('../middleware/auth');
const roleMiddleware = require('../middleware/roles');

router.use(authMiddleware);

// Rutas GET públicas para cualquier usuario autenticado
router.get('/servicios', adminController.getServicios);
router.get('/consultorios', adminController.getConsultorios);
router.get('/responsables', adminController.getResponsables);
router.get('/sedes', adminController.getSedes);

// Rutas que solo admin puede usar
router.use(roleMiddleware('admin'));

// Reportes y sistema
router.get('/reportes/diario', adminController.getReporteDiario);
router.get('/reportes/avanzadas', adminController.getEstadisticasAvanzadas);
router.post('/sistema/cerrar', adminController.cerrarSistema);
router.post('/reset-db', adminController.resetDatabase);

// Servicios - CRUD
router.post(
	'/servicios',
	adminController.crearServicio
);
router.put(
	'/servicios/:id',
	adminController.actualizarServicio
);
router.delete('/servicios/:id', adminController.eliminarServicio);

// Aseguradoras - CRUD
router.put('/aseguradoras/:id', adminController.actualizarAseguradora);
router.delete('/aseguradoras/:id', adminController.eliminarAseguradora);

// Consultorios - CRUD
router.post(
	'/consultorios',
	adminController.crearConsultorio
);
router.put(
	'/consultorios/:id',
	adminController.actualizarConsultorio
);
router.delete('/consultorios/:id', adminController.eliminarConsultorio);

// Médicos - CRUD
router.get('/medicos', adminController.getMedicos);
router.post(
	'/medicos',
	adminController.crearMedico
);
router.put(
	'/medicos/:id',
	adminController.actualizarMedico
);
router.delete('/medicos/:id', adminController.eliminarMedico);

// Recepcionistas - CRUD
router.get('/recepcionistas', adminController.getRecepcionistas);
router.post(
  '/recepcionistas',
  adminController.crearRecepcionista
);
router.put('/recepcionistas/:id', adminController.actualizarRecepcionista);
router.delete('/recepcionistas/:id', adminController.eliminarRecepcionista);

// Personal Genérico - CRUD
router.get('/personal', adminController.getUsuarios);
router.post('/personal', adminController.crearUsuario);
router.put('/personal/:id', adminController.actualizarUsuario);
router.delete('/personal/:id', adminController.eliminarUsuario);

module.exports = router;
