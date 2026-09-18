const logger = require('../config/logger');
const consultorioRepo = require('../repositories/consultorio.repository');
const { getSede } = require('./admin.helpers');

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
    const piso = (req.body.piso !== undefined && req.body.piso !== null)
      ? String(req.body.piso).trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
      : null;
    await consultorioRepo.createConsultorio(nombre, sede, piso);
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
    const piso = (req.body.piso !== undefined && req.body.piso !== null)
      ? String(req.body.piso).trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
      : null;
    await consultorioRepo.updateConsultorio(id, sede, nombre, piso);
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

module.exports = { getConsultorios, crearConsultorio, actualizarConsultorio, eliminarConsultorio };
