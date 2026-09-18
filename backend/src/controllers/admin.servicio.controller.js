const logger = require('../config/logger');
const servicioRepo = require('../repositories/servicio.repository');

const getServicios = async (req, res) => {
  try {
    const rows = await servicioRepo.getAll(req.usuario?.id_sede);
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

module.exports = { getServicios, crearServicio, actualizarServicio, eliminarServicio };
