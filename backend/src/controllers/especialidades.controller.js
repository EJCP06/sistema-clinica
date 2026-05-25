const db = require('../config/db');

const getEspecialidades = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT e.*, e.id_especialidad as id,
             s.nombre_servicio,
             c.nombre AS consultorio_nombre
      FROM "Especialidades" e
      JOIN "Servicio" s ON e.id_servicio = s.id_servicio
      LEFT JOIN "Consultorios" c ON e.id_consultorio = c.id_consultorio
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const createEspecialidad = async (req, res) => {
  const { nombre, prefijo, id_servicio, id_sede, piso, id_consultorio, activo } = req.body;
  try {
    const result = await db.query(
      `INSERT INTO "Especialidades" (nombre, prefijo, id_servicio, id_sede, piso, id_consultorio, activo)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [nombre, prefijo, id_servicio, id_sede, piso, id_consultorio || null, activo !== false],
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const updateEspecialidad = async (req, res) => {
  const { id } = req.params;
  const { nombre, prefijo, id_servicio, id_sede, piso, id_consultorio, activo } = req.body;
  try {
    const result = await db.query(
      `UPDATE "Especialidades"
       SET nombre = COALESCE($1, nombre),
           prefijo = COALESCE($2, prefijo),
           id_servicio = COALESCE($3, id_servicio),
           id_sede = COALESCE($4, id_sede),
           piso = COALESCE($5, piso),
           id_consultorio = COALESCE($6, id_consultorio),
           activo = COALESCE($7, activo)
       WHERE id_especialidad = $8
       RETURNING *`,
      [nombre, prefijo, id_servicio, id_sede, piso, id_consultorio, activo, id],
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const deleteEspecialidad = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM "Especialidades" WHERE id_especialidad = $1', [id]);
    res.json({ mensaje: 'Especialidad eliminada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getEspecialidades, createEspecialidad, updateEspecialidad, deleteEspecialidad };
