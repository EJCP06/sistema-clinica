const express = require('express');
const { body, param, validationResult } = require('express-validator');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const sharedController = require('../controllers/shared.controller');
const authMiddleware = require('../middleware/auth');
const permissionMiddleware = require('../middleware/permission').permissionMiddleware;
const soloAdministrador = require('../middleware/permission').soloAdministrador;

const validar = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ mensaje: errors.array()[0].msg });
  next();
};

router.use(authMiddleware);

router.get('/sedes', permissionMiddleware('admision:crear', 'aps:ver', 'aseguradoras:ver', 'laboratorio:registrar_caja', 'imagenes:registrar_caja', 'atencion_medica:llamar_siguiente', 'especialidades:ver'), adminController.getSedes);

const recepcionController = require('../controllers/recepcion.controller');
router.get('/responsables', permissionMiddleware('admision:crear'), recepcionController.getResponsablesPago);

router.get('/servicios', permissionMiddleware('admision:crear', 'aps:ver', 'laboratorio:registrar_caja', 'imagenes:registrar_caja', 'atencion_medica:llamar_siguiente'), adminController.getServicios);
router.post('/servicios', soloAdministrador, [
  body('nombre_servicio').trim().notEmpty().withMessage('El nombre del servicio es obligatorio'),
  validar,
], adminController.crearServicio);
router.put('/servicios/:id', soloAdministrador, adminController.actualizarServicio);
router.delete('/servicios/:id', soloAdministrador, adminController.eliminarServicio);

router.get('/consultorios', permissionMiddleware('admision:crear', 'aps:ver', 'laboratorio:registrar_caja', 'imagenes:registrar_caja', 'atencion_medica:llamar_siguiente', 'especialidades:ver'), adminController.getConsultorios);
router.post('/consultorios', soloAdministrador, [
  body('nombre').trim().notEmpty().withMessage('El nombre del consultorio es obligatorio'),
  body('id_servicio').isInt().withMessage('El servicio es obligatorio'),
  validar,
], adminController.crearConsultorio);
router.put('/consultorios/:id', soloAdministrador, adminController.actualizarConsultorio);
router.delete('/consultorios/:id', soloAdministrador, adminController.eliminarConsultorio);

router.get('/personal', permissionMiddleware('personal:ver', 'personal:crear', 'personal:editar', 'personal:eliminar', 'admision:*', 'aps:ver', 'laboratorio:*', 'imagenes:*'), adminController.getPersonal);
router.post('/personal', permissionMiddleware('personal:crear'), [
  body('primer_nombre').trim().notEmpty().withMessage('El primer nombre es obligatorio'),
  body('primer_apellido').trim().notEmpty().withMessage('El primer apellido es obligatorio'),
  body('cedula').trim().notEmpty().withMessage('La cédula es obligatoria'),
  validar,
], adminController.crearPersonal);
router.put('/personal/:id', permissionMiddleware('personal:editar'), adminController.actualizarPersonal);
router.delete('/personal/:id', permissionMiddleware('personal:eliminar'), adminController.eliminarPersonal);
router.post('/personal/importar', permissionMiddleware('personal:crear'), adminController.importarPersonal);

router.get('/reportes/diario', permissionMiddleware('reportes:ver'), adminController.getReporteDiario);

router.delete('/aseguradoras/:id', permissionMiddleware('aseguradoras:eliminar'), [
  param('id').isInt().withMessage('ID inválido'),
  validar,
], sharedController.eliminarAseguradora);

router.get('/roles', permissionMiddleware('roles:ver', 'roles:crear', 'roles:editar', 'roles:eliminar'), adminController.getRoles);
router.post('/roles', permissionMiddleware('roles:crear'), [
  body('nombre').trim().notEmpty().withMessage('El nombre del rol es obligatorio'),
  validar,
], adminController.crearRol);
router.put('/roles/:id', permissionMiddleware('roles:editar'), adminController.actualizarRol);
router.delete('/roles/:id', permissionMiddleware('roles:eliminar'), adminController.eliminarRol);

router.get('/permisos', permissionMiddleware('permisologia:gestionar_permisos'), adminController.getPermisos);
router.get('/permisos/matriz', permissionMiddleware('permisologia:gestionar_permisos'), adminController.getMatrizPermisos);
router.post('/permisos/recargar-cache', permissionMiddleware('permisologia:gestionar_permisos'), adminController.recargarCachePermisos);
router.get('/roles/:id/permisos', permissionMiddleware('permisologia:gestionar_permisos'), adminController.getPermisosByRol);
router.put('/roles/:id/permisos', permissionMiddleware('permisologia:gestionar_permisos'), adminController.asignarPermisos);
router.post('/permisos/seed-admin', adminController.seedPermisosAdmin);

module.exports = router;
