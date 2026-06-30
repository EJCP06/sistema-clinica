const pool = require('../config/db');

const getConsultoriosBySede = async (sede) => {
  let query = `SELECT id_consultorio as id, nombre, estado_fisico as estado, id_servicio as servicio_id
     FROM "Consultorios"`;
  const params = [];
  
  if (sede && Number(sede) !== 0) {
    query += ` WHERE id_sede = $1`;
    params.push(Number(sede));
  }
  
  const result = await pool.query(query, params);
  return result.rows;
};

const getConsultorioById = async (clientOrId, idOnly) => {
  const client = idOnly !== undefined ? clientOrId : pool;
  const consultorioId = idOnly !== undefined ? idOnly : clientOrId;
  const result = await client.query(
    'SELECT estado_fisico as estado, id_servicio as servicio_id, nombre FROM "Consultorios" WHERE id_consultorio = $1 FOR UPDATE',
    [consultorioId],
  );
  return result.rows[0] || null;
};

const createConsultorio = async (nombre, sede) => {
  await pool.query(
    `INSERT INTO "Consultorios" (nombre, id_sede) VALUES ($1, $2)`,
    [nombre, sede],
  );
};

const updateConsultorio = async (id, sede, nombre) => {
  await pool.query(
    `UPDATE "Consultorios" SET nombre = $1 WHERE id_consultorio = $2 AND id_sede = $3`,
    [nombre, id, sede],
  );
};

const deleteConsultorio = async (id, sede) => {
  await pool.query(
    `DELETE FROM "Consultorios" WHERE id_consultorio = $1 AND id_sede = $2`,
    [id, sede],
  );
};

const setEstadoFisico = async (client, consultorioId, estado) => {
  await client.query(
    'UPDATE "Consultorios" SET estado_fisico = $1 WHERE id_consultorio = $2',
    [estado, consultorioId],
  );
};

module.exports = {
  getConsultoriosBySede,
  getConsultorioById,
  createConsultorio,
  updateConsultorio,
  deleteConsultorio,
  setEstadoFisico,
};
