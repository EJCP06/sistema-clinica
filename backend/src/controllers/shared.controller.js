const pool = require('../config/db');
const logger = require('../config/logger');

const getAseguradoras = async (req, res) => {
  const sede = req.usuario?.id_sede;
  if (!sede) return res.status(401).json({ mensaje: 'Sin sede' });

  try {
    const result = await pool.query(
      `SELECT id_cliente, nombre as aseguradora, id_sede
       FROM "cliente"
       WHERE id_tipo_cliente = 2 AND id_sede = $1
       ORDER BY nombre`,
      [sede],
    );
    res.json(result.rows);
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

    const result = await pool.query(
      `INSERT INTO "cliente" (id_tipo_cliente, nombre, id_sede) VALUES (2, $1, $2) RETURNING id_cliente`,
      [nombre, sede],
    );

    res.status(201).json({ mensaje: 'Aseguradora creada', id: result.rows[0].id_cliente });
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
    const result = await pool.query(
      'DELETE FROM "cliente" WHERE id_cliente = $1 AND id_sede = $2 RETURNING id_cliente',
      [id, sede],
    );

    if (result.rowCount === 0) {
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
