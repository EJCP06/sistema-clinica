const logger = require('../config/logger');
const servicioRepo = require('../repositories/servicio.repository');
const consultorioRepo = require('../repositories/consultorio.repository');
const { getSede } = require('./_helpers');

const getServicios = async (req, res) => {
  const sede = getSede(req, res);
  if (!sede) return;
  try {
    const rows = await servicioRepo.getAll(sede);
    res.json(rows);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ mensaje: 'Error al obtener servicios' });
  }
};

const crearServicio = async (req, res) => {
  try {
    const { nombre, prefijo, piso, activo } = req.body;
    await servicioRepo.create(nombre, prefijo, piso, activo);
    res.status(201).json({ mensaje: 'Servicio creado' });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ mensaje: 'Error al crear servicio' });
  }
};

const actualizarServicio = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, prefijo, piso, activo } = req.body;
    await servicioRepo.update(id, nombre, prefijo, piso, activo);
    res.json({ mensaje: 'Servicio actualizado' });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ mensaje: 'Error al actualizar servicio' });
  }
};

const eliminarServicio = async (req, res) => {
  try {
    await servicioRepo.remove(req.params.id);
    res.json({ mensaje: 'Servicio eliminado' });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ mensaje: 'Error al eliminar servicio' });
  }
};

const getConsultorios = async (req, res) => {
  const sede = getSede(req, res);
  if (!sede) return;
  try {
    const rows = await consultorioRepo.getConsultoriosBySede(sede);
    res.json(rows);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ mensaje: 'Error al obtener consultorios' });
  }
};

const crearConsultorio = async (req, res) => {
  const sede = getSede(req, res);
  if (!sede) return;
  try {
    const { nombre } = req.body;
    await consultorioRepo.createConsultorio(nombre, sede);
    res.json({ mensaje: 'Consultorio creado' });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ mensaje: 'Error al crear consultorio' });
  }
};

const actualizarConsultorio = async (req, res) => {
  const sede = getSede(req, res);
  if (!sede) return;
  try {
    const { id } = req.params;
    const { nombre } = req.body;
    await consultorioRepo.updateConsultorio(id, sede, nombre);
    res.json({ mensaje: 'Consultorio actualizado' });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ mensaje: 'Error al actualizar consultorio' });
  }
};

const eliminarConsultorio = async (req, res) => {
  const sede = getSede(req, res);
  if (!sede) return;
  try {
    await consultorioRepo.deleteConsultorio(req.params.id, sede);
    res.json({ mensaje: 'Consultorio eliminado' });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ mensaje: 'Error al eliminar consultorio' });
  }
};

module.exports = {
  getServicios, crearServicio, actualizarServicio, eliminarServicio,
  getConsultorios, crearConsultorio, actualizarConsultorio, eliminarConsultorio,
};
