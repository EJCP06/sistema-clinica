const db = require('../config/db');

const getEspecialidades = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT e.*, e.id_especialidad as id,
             s.nombre_servicio
      FROM "Especialidades" e
      JOIN "Servicio" s ON e.id_servicio = s.id_servicio
      ORDER BY e.nombre ASC
    `);

    // Para cada especialidad, obtener sus consultorios desde la junction table
    const espConIds = await db.query(`
      SELECT id_especialidad, id_consultorio FROM "Especialidad_Consultorio"
    `);

    const consultoriosPorEsp = {};
    for (const row of espConIds.rows) {
      if (!consultoriosPorEsp[row.id_especialidad]) {
        consultoriosPorEsp[row.id_especialidad] = [];
      }
      consultoriosPorEsp[row.id_especialidad].push(row.id_consultorio);
    }

    const rows = result.rows.map((e) => ({
      ...e,
      consultorios_ids: consultoriosPorEsp[e.id_especialidad] || [],
    }));

    res.json(rows);
  } catch (err) {
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

const createEspecialidad = async (req, res) => {
  const { nombre, prefijo, id_servicio, id_sede, piso, consultorios_ids, activo } = req.body;
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO "Especialidades" (nombre, prefijo, id_servicio, id_sede, piso, activo)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [nombre, prefijo, id_servicio, id_sede, piso, activo !== false],
    );
    const espId = result.rows[0].id_especialidad;

    if (consultorios_ids && consultorios_ids.length > 0) {
      for (const conId of consultorios_ids) {
        await client.query(
          `INSERT INTO "Especialidad_Consultorio" (id_especialidad, id_consultorio) VALUES ($1, $2)`,
          [espId, conId],
        );
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ ...result.rows[0], consultorios_ids: consultorios_ids || [] });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  } finally {
    client.release();
  }
};

const updateEspecialidad = async (req, res) => {
  const { id } = req.params;
  const { nombre, prefijo, id_servicio, id_sede, piso, consultorios_ids, activo } = req.body;
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const sets = [];
    const values = [];
    let idx = 1;

    if (nombre !== undefined) { sets.push(`nombre = $${idx++}`); values.push(nombre); }
    if (prefijo !== undefined) { sets.push(`prefijo = $${idx++}`); values.push(prefijo); }
    if (id_servicio !== undefined) { sets.push(`id_servicio = $${idx++}`); values.push(id_servicio); }
    if (id_sede !== undefined) { sets.push(`id_sede = $${idx++}`); values.push(id_sede); }
    if (piso !== undefined) { sets.push(`piso = $${idx++}`); values.push(piso); }
    if (activo !== undefined) { sets.push(`activo = $${idx++}`); values.push(activo); }

    if (sets.length > 0) {
      values.push(id);
      await client.query(
        `UPDATE "Especialidades" SET ${sets.join(', ')} WHERE id_especialidad = $${idx} RETURNING *`,
        values,
      );
    }

    if (consultorios_ids !== undefined) {
      await client.query(`DELETE FROM "Especialidad_Consultorio" WHERE id_especialidad = $1`, [id]);
      for (const conId of consultorios_ids) {
        await client.query(
          `INSERT INTO "Especialidad_Consultorio" (id_especialidad, id_consultorio) VALUES ($1, $2)`,
          [id, conId],
        );
      }
    }

    await client.query('COMMIT');

    const result = await db.query(`SELECT * FROM "Especialidades" WHERE id_especialidad = $1`, [id]);
    const consultorios = await db.query(
      `SELECT id_consultorio FROM "Especialidad_Consultorio" WHERE id_especialidad = $1`, [id],
    );
    res.json({
      ...result.rows[0],
      consultorios_ids: consultorios.rows.map((r) => r.id_consultorio),
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  } finally {
    client.release();
  }
};

const deleteEspecialidad = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM "Especialidad_Consultorio" WHERE id_especialidad = $1', [id]);
    await db.query('DELETE FROM "Especialidades" WHERE id_especialidad = $1', [id]);
    res.json({ mensaje: 'Especialidad eliminada' });
  } catch (err) {
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

module.exports = { getEspecialidades, createEspecialidad, updateEspecialidad, deleteEspecialidad };
