const express = require('express');
const { body, param, validationResult } = require('express-validator');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const sharedController = require('../controllers/shared.controller');
const authMiddleware = require('../middleware/auth');
const roleMiddleware = require('../middleware/roles');

const validar = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ mensaje: errors.array()[0].msg });
  next();
};

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// SEDES
router.get('/sedes', roleMiddleware('administrador', 'recepcionista', 'medico', 'coordinador', 'analista'), adminController.getSedes);

// RESPONSABLES DE PAGO (lo usa APS)
const recepcionController = require('../controllers/recepcion.controller');
router.get('/responsables', roleMiddleware('administrador', 'recepcionista'), recepcionController.getResponsablesPago);

// SERVICIOS
router.get('/servicios', roleMiddleware('administrador', 'recepcionista', 'medico', 'coordinador', 'analista'), adminController.getServicios);
router.post('/servicios', roleMiddleware('administrador'), [
  body('nombre_servicio').trim().notEmpty().withMessage('El nombre del servicio es obligatorio'),
  validar,
], adminController.crearServicio);
router.put('/servicios/:id', roleMiddleware('administrador'), adminController.actualizarServicio);
router.delete('/servicios/:id', roleMiddleware('administrador'), adminController.eliminarServicio);

// CONSULTORIOS
router.get('/consultorios', roleMiddleware('administrador', 'recepcionista', 'medico', 'coordinador', 'analista'), adminController.getConsultorios);
router.post('/consultorios', roleMiddleware('administrador'), [
  body('nombre').trim().notEmpty().withMessage('El nombre del consultorio es obligatorio'),
  body('id_servicio').isInt().withMessage('El servicio es obligatorio'),
  validar,
], adminController.crearConsultorio);
router.put('/consultorios/:id', roleMiddleware('administrador'), adminController.actualizarConsultorio);
router.delete('/consultorios/:id', roleMiddleware('administrador'), adminController.eliminarConsultorio);

// PERSONAL
router.get('/personal', roleMiddleware('administrador', 'recepcionista', 'medico', 'coordinador', 'analista'), adminController.getPersonal);
router.post('/personal', roleMiddleware('administrador'), [
  body('nombre').trim().notEmpty().withMessage('El nombre es obligatorio'),
  body('apellido').trim().notEmpty().withMessage('El apellido es obligatorio'),
  body('cedula').trim().notEmpty().withMessage('La cédula es obligatoria'),
  validar,
], adminController.crearPersonal);
router.put('/personal/:id', roleMiddleware('administrador'), adminController.actualizarPersonal);
router.delete('/personal/:id', roleMiddleware('administrador'), adminController.eliminarPersonal);
router.post('/personal/importar', roleMiddleware('administrador'), adminController.importarPersonal);

// REPORTES
router.get('/reportes/diario', roleMiddleware('administrador'), adminController.getReporteDiario);



// ASEGURADORAS
router.delete('/aseguradoras/:id', roleMiddleware('administrador'), [
  param('id').isInt().withMessage('ID inválido'),
  validar,
], sharedController.eliminarAseguradora);

// ROLES
router.get('/roles', roleMiddleware('administrador'), adminController.getRoles);
router.post('/roles', roleMiddleware('administrador'), [
  body('nombre').trim().notEmpty().withMessage('El nombre del rol es obligatorio'),
  validar,
], adminController.crearRol);
router.put('/roles/:id', roleMiddleware('administrador'), adminController.actualizarRol);
router.delete('/roles/:id', roleMiddleware('administrador'), adminController.eliminarRol);

module.exports = router;
