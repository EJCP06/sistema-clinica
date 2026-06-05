const db = require('../config/db');
const espRepo = require('../repositories/especialidad.repository');

const getEspecialidades = async (req, res) => {
  try {
    const especialidades = await espRepo.getAll();
    const relaciones = await espRepo.getConsultoriosByEspecialidad();

    const consultoriosPorEsp = {};
    for (const row of relaciones) {
      if (!consultoriosPorEsp[row.id_especialidad]) {
        consultoriosPorEsp[row.id_especialidad] = [];
      }
      consultoriosPorEsp[row.id_especialidad].push(row.id_consultorio);
    }

    const rows = especialidades.map((e) => ({
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

    const esp = await espRepo.create(client, { nombre, prefijo, id_servicio, id_sede, piso, activo });
    const espId = esp.id_especialidad;

    if (consultorios_ids && consultorios_ids.length > 0) {
      for (const conId of consultorios_ids) {
        await espRepo.insertConsultorioRelation(client, espId, conId);
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ ...esp, consultorios_ids: consultorios_ids || [] });
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
      await espRepo.update(client, id, sets, values, idx);
    }

    if (consultorios_ids !== undefined) {
      await espRepo.deleteConsultorioRelations(client, id);
      for (const conId of consultorios_ids) {
        await espRepo.insertConsultorioRelation(client, id, conId);
      }
    }

    await client.query('COMMIT');

    const result = await espRepo.getById(id);
    const consultoriosIds = await espRepo.getConsultorioIdsByEspecialidad(id);
    res.json({
      ...result,
      consultorios_ids: consultoriosIds,
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
    await espRepo.remove(id);
    res.json({ mensaje: 'Especialidad eliminada' });
  } catch (err) {
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

module.exports = { getEspecialidades, createEspecialidad, updateEspecialidad, deleteEspecialidad };
