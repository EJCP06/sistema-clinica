const reporte = require('./admin.reporte.controller');
const servicio = require('./admin.servicio.controller');
const consultorio = require('./admin.consultorio.controller');
const personal = require('./admin.personal.controller');
const rol = require('./admin.rol.controller');
const permiso = require('./admin.permiso.controller');
const sharedRepo = require('../repositories/shared.repository');
const { getSede } = require('./admin.helpers');

const getSedes = async (req, res) => {
  const sede = getSede(req, res);
  if (!sede) return;

  try {
    const rows = await sharedRepo.getSedes();
    res.json(rows);
  } catch (error) {
    const logger = require('../config/logger');
    logger.error(error);
    res.status(500).json({ mensaje: 'Error al obtener sedes' });
  }
};

module.exports = {
  getSedes,

  getReporteDiario: reporte.getReporteDiario,

  getServicios: servicio.getServicios,
  crearServicio: servicio.crearServicio,
  actualizarServicio: servicio.actualizarServicio,
  eliminarServicio: servicio.eliminarServicio,

  getConsultorios: consultorio.getConsultorios,
  crearConsultorio: consultorio.crearConsultorio,
  actualizarConsultorio: consultorio.actualizarConsultorio,
  eliminarConsultorio: consultorio.eliminarConsultorio,

  getPersonal: personal.getPersonal,
  crearPersonal: personal.crearPersonal,
  actualizarPersonal: personal.actualizarPersonal,
  eliminarPersonal: personal.eliminarPersonal,
  importarPersonal: personal.importarPersonal,

  getRoles: rol.getRoles,
  crearRol: rol.crearRol,
  actualizarRol: rol.actualizarRol,
  eliminarRol: rol.eliminarRol,

  getPermisos: permiso.getPermisos,
  getPermisosByRol: permiso.getPermisosByRol,
  asignarPermisos: permiso.asignarPermisos,
  getMatrizPermisos: permiso.getMatrizPermisos,
  recargarCachePermisos: permiso.recargarCachePermisos,
  seedPermisosAdmin: permiso.seedPermisosAdmin,
};
