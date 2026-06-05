const logger = require('../config/logger');
const sharedRepo = require('../repositories/shared.repository');

const getAseguradoras = async (req, res) => {
  const sede = req.usuario?.id_sede;
  if (!sede) return res.status(401).json({ mensaje: 'Sin sede' });

  try {
    const rows = await sharedRepo.getAseguradoras(sede);
    res.json(rows);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ mensaje: 'Error al obtener aseguradoras' });
  }
};

const crearAseguradora = async (req, res) => {
  const sede = req.usuario?.id_sede;
  if (!sede) return res.status(401).json({ mensaje: 'Sin sede' });

  try {
    const { nombre } = req.body;
    if (!nombre) return res.status(400).json({ mensaje: 'Nombre requerido' });

    const result = await sharedRepo.crearAseguradora(nombre, sede);
    res.status(201).json({ mensaje: 'Aseguradora creada', id: result.id_cliente });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ mensaje: 'Error al crear aseguradora' });
  }
};

const eliminarAseguradora = async (req, res) => {
  const sede = req.usuario?.id_sede;
  if (!sede) return res.status(401).json({ mensaje: 'Sin sede' });

  try {
    const { id } = req.params;
    const eliminado = await sharedRepo.eliminarAseguradora(id, sede);

    if (!eliminado) {
      return res.status(404).json({ mensaje: 'Aseguradora no encontrada' });
    }

    res.json({ mensaje: 'Aseguradora eliminada' });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ mensaje: 'Error al eliminar aseguradora' });
  }
};

module.exports = {
  getAseguradoras,
  crearAseguradora,
  eliminarAseguradora,
};
