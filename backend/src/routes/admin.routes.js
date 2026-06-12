const express = require('express');
const { body, param, validationResult } = require('express-validator');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const sharedController = require('../controllers/shared.controller');
const authMiddleware = require('../middleware/auth');
const permissionMiddleware = require('../middleware/permission');

const validar = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ mensaje: errors.array()[0].msg });
  next();
};

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// SEDES
router.get('/sedes', permissionMiddleware('gestionar_sedes', 'admision_crear', 'aps_enviar_presupuesto', 'aseguradoras_crear', 'laboratorio_registrar_caja', 'imagenes_registrar_caja', 'atencion_medica_llamar_siguiente', 'especialidades_crear'), adminController.getSedes);

// RESPONSABLES DE PAGO (lo usa APS)
const recepcionController = require('../controllers/recepcion.controller');
router.get('/responsables', permissionMiddleware('admision_crear'), recepcionController.getResponsablesPago);

// SERVICIOS
router.get('/servicios', permissionMiddleware('gestionar_servicios', 'admision_crear', 'aps_enviar_presupuesto', 'laboratorio_registrar_caja', 'imagenes_registrar_caja', 'atencion_medica_llamar_siguiente'), adminController.getServicios);
router.post('/servicios', permissionMiddleware('gestionar_servicios'), [
  body('nombre_servicio').trim().notEmpty().withMessage('El nombre del servicio es obligatorio'),
  validar,
], adminController.crearServicio);
router.put('/servicios/:id', permissionMiddleware('gestionar_servicios'), adminController.actualizarServicio);
router.delete('/servicios/:id', permissionMiddleware('gestionar_servicios'), adminController.eliminarServicio);

// CONSULTORIOS
router.get('/consultorios', permissionMiddleware('gestionar_servicios', 'admision_crear', 'aps_enviar_presupuesto', 'laboratorio_registrar_caja', 'imagenes_registrar_caja', 'atencion_medica_llamar_siguiente'), adminController.getConsultorios);
router.post('/consultorios', permissionMiddleware('gestionar_servicios'), [
  body('nombre').trim().notEmpty().withMessage('El nombre del consultorio es obligatorio'),
  body('id_servicio').isInt().withMessage('El servicio es obligatorio'),
  validar,
], adminController.crearConsultorio);
router.put('/consultorios/:id', permissionMiddleware('gestionar_servicios'), adminController.actualizarConsultorio);
router.delete('/consultorios/:id', permissionMiddleware('gestionar_servicios'), adminController.eliminarConsultorio);

// PERSONAL
router.get('/personal', permissionMiddleware('personal_crear', 'personal_editar', 'personal_eliminar'), adminController.getPersonal);
router.post('/personal', permissionMiddleware('personal_crear'), [
  body('nombre').trim().notEmpty().withMessage('El nombre es obligatorio'),
  body('apellido').trim().notEmpty().withMessage('El apellido es obligatorio'),
  body('cedula').trim().notEmpty().withMessage('La cédula es obligatoria'),
  validar,
], adminController.crearPersonal);
router.put('/personal/:id', permissionMiddleware('personal_editar'), adminController.actualizarPersonal);
router.delete('/personal/:id', permissionMiddleware('personal_eliminar'), adminController.eliminarPersonal);
router.post('/personal/importar', permissionMiddleware('personal_crear'), adminController.importarPersonal);

// REPORTES
router.get('/reportes/diario', permissionMiddleware('ver_reportes'), adminController.getReporteDiario);

// ASEGURADORAS
router.delete('/aseguradoras/:id', permissionMiddleware('aseguradoras_crear', 'aseguradoras_editar', 'aseguradoras_eliminar'), [
  param('id').isInt().withMessage('ID inválido'),
  validar,
], sharedController.eliminarAseguradora);

// ROLES
router.get('/roles', permissionMiddleware('roles_crear', 'roles_editar', 'roles_eliminar'), adminController.getRoles);
router.post('/roles', permissionMiddleware('roles_crear'), [
  body('nombre').trim().notEmpty().withMessage('El nombre del rol es obligatorio'),
  validar,
], adminController.crearRol);
router.put('/roles/:id', permissionMiddleware('roles_editar'), adminController.actualizarRol);
router.delete('/roles/:id', permissionMiddleware('roles_eliminar'), adminController.eliminarRol);

// PERMISOS
router.get('/permisos', permissionMiddleware('gestionar_permisos'), adminController.getPermisos);
router.get('/roles/:id/permisos', permissionMiddleware('gestionar_permisos'), adminController.getPermisosByRol);
router.put('/roles/:id/permisos', permissionMiddleware('gestionar_permisos'), adminController.asignarPermisos);

module.exports = router;
