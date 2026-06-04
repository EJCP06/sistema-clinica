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

// Todas las rutas require token y rol admin
router.use(authMiddleware);
router.use(roleMiddleware('admin'));

// SEDES
router.get('/sedes', adminController.getSedes);

// RESPONSABLES DE PAGO (lo usa APS)
const recepcionController = require('../controllers/recepcion.controller');
router.get('/responsables', recepcionController.getResponsablesPago);

// SERVICIOS
router.get('/servicios', adminController.getServicios);
router.post('/servicios', [
  body('nombre_servicio').trim().notEmpty().withMessage('El nombre del servicio es obligatorio'),
  validar,
], adminController.crearServicio);
router.put('/servicios/:id', adminController.actualizarServicio);
router.delete('/servicios/:id', adminController.eliminarServicio);

// CONSULTORIOS
router.get('/consultorios', adminController.getConsultorios);
router.post('/consultorios', [
  body('nombre').trim().notEmpty().withMessage('El nombre del consultorio es obligatorio'),
  body('id_servicio').isInt().withMessage('El servicio es obligatorio'),
  validar,
], adminController.crearConsultorio);
router.put('/consultorios/:id', adminController.actualizarConsultorio);
router.delete('/consultorios/:id', adminController.eliminarConsultorio);

// PERSONAL
router.get('/personal', adminController.getPersonal);
router.post('/personal', [
  body('nombre').trim().notEmpty().withMessage('El nombre es obligatorio'),
  body('apellido').trim().notEmpty().withMessage('El apellido es obligatorio'),
  body('cedula').trim().notEmpty().withMessage('La cédula es obligatoria'),
  body('password').isLength({ min: 4 }).withMessage('La contraseña debe tener al menos 4 caracteres'),
  validar,
], adminController.crearPersonal);
router.put('/personal/:id', adminController.actualizarPersonal);
router.delete('/personal/:id', adminController.eliminarPersonal);

// REPORTES
router.get('/reportes/diario', adminController.getReporteDiario);



// ASEGURADORAS
router.delete('/aseguradoras/:id', [
  param('id').isInt().withMessage('ID inválido'),
  validar,
], sharedController.eliminarAseguradora);

module.exports = router;
