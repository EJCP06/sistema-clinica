const logger = require('../config/logger');
const sharedRepo = require('../repositories/shared.repository');

/**
 * Obtiene todas las aseguradoras activas para la sede del usuario.
 *
 * @param {import('express').Request} req - Petición HTTP
 * @param {import('express').Response} res - Respuesta HTTP
 * @returns {Promise<void>}
 */
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

/**
 * Crea una nueva aseguradora en la sede del usuario.
 *
 * @param {import('express').Request} req - Petición HTTP
 * @param {import('express').Response} res - Respuesta HTTP
 * @returns {Promise<void>}
 */
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

/**
 * Elimina una aseguradora del sistema.
 *
 * @param {import('express').Request} req - Petición HTTP
 * @param {import('express').Response} res - Respuesta HTTP
 * @returns {Promise<void>}
 */
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

/**
 * Importa aseguradoras desde un arreglo de nombres (típicamente Excel).
 * Deduplica por nombre y reporta importados/omitidos.
 *
 * @param {import('express').Request} req - Petición HTTP
 * @param {import('express').Response} res - Respuesta HTTP
 * @returns {Promise<void>}
 */
const importarAseguradoras = async (req, res) => {
  const sede = req.usuario?.id_sede;
  if (!sede) return res.status(401).json({ mensaje: 'Sin sede' });

  try {
    const { rows } = req.body;
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ mensaje: 'No hay datos para importar' });
    }

    const nombres = rows.map(r =>
      (r.nombre || r.Nombre || r.NOMBRE || r.aseguradora || r.Aseguradora || '').toString().toUpperCase().trim()
    ).filter(n => n);

    if (nombres.length === 0) {
      return res.status(400).json({ mensaje: 'No se encontraron nombres válidos en el archivo' });
    }

    const result = await sharedRepo.importarAseguradoras(nombres, sede);

    res.json({
      mensaje: `Importación completada: ${result.importados} importadas, ${result.omitidos} ya existían`,
      importados: result.importados,
      omitidos: result.omitidos,
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ mensaje: 'Error al importar aseguradoras' });
  }
};

module.exports = {
  getAseguradoras,
  crearAseguradora,
  eliminarAseguradora,
  importarAseguradoras,
};
