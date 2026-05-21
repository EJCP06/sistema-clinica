const db = require('../config/db');

const getEspecialidades = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM "Especialidades" WHERE "activo" = true');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const createEspecialidad = async (req, res) => {
  const { nombre, prefijo, id_servicio, id_sede, piso } = req.body;
  try {
    const result = await db.query(
      'INSERT INTO "Especialidades" (nombre, prefijo, id_servicio, id_sede, piso) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [nombre, prefijo, id_servicio, id_sede, piso]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getEspecialidades, createEspecialidad };
