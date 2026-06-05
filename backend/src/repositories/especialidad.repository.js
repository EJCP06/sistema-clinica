const db = require('../config/db');

const getAll = async () => {
  const result = await db.query(`
    SELECT e.*, e.id_especialidad as id,
           s.nombre_servicio
    FROM "Especialidades" e
    JOIN "Servicio" s ON e.id_servicio = s.id_servicio
    ORDER BY e.nombre ASC
  `);
  return result.rows;
};

const getConsultoriosByEspecialidad = async () => {
  const result = await db.query(
    `SELECT id_especialidad, id_consultorio FROM "Especialidad_Consultorio"`
  );
  return result.rows;
};

const create = async (client, data) => {
  const result = await client.query(
    `INSERT INTO "Especialidades" (nombre, prefijo, id_servicio, id_sede, piso, activo)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [data.nombre, data.prefijo, data.id_servicio, data.id_sede, data.piso, data.activo !== false],
  );
  return result.rows[0];
};

const insertConsultorioRelation = async (client, espId, conId) => {
  await client.query(
    `INSERT INTO "Especialidad_Consultorio" (id_especialidad, id_consultorio) VALUES ($1, $2)`,
    [espId, conId],
  );
};

const update = async (client, id, sets, values, idx) => {
  values.push(id);
  await client.query(
    `UPDATE "Especialidades" SET ${sets.join(', ')} WHERE id_especialidad = $${idx} RETURNING *`,
    values,
  );
};

const deleteConsultorioRelations = async (client, id) => {
  await client.query(`DELETE FROM "Especialidad_Consultorio" WHERE id_especialidad = $1`, [id]);
};

const remove = async (id) => {
  await db.query('DELETE FROM "Especialidad_Consultorio" WHERE id_especialidad = $1', [id]);
  await db.query('DELETE FROM "Especialidades" WHERE id_especialidad = $1', [id]);
};

const getById = async (id) => {
  const result = await db.query(`SELECT * FROM "Especialidades" WHERE id_especialidad = $1`, [id]);
  return result.rows[0] || null;
};

const getConsultorioIdsByEspecialidad = async (id) => {
  const result = await db.query(
    `SELECT id_consultorio FROM "Especialidad_Consultorio" WHERE id_especialidad = $1`, [id],
  );
  return result.rows.map((r) => r.id_consultorio);
};

module.exports = {
  getAll,
  getConsultoriosByEspecialidad,
  create,
  insertConsultorioRelation,
  update,
  deleteConsultorioRelations,
  remove,
  getById,
  getConsultorioIdsByEspecialidad,
};
