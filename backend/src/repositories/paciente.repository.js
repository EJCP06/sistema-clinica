const pool = require('../config/db');

const buscarPaciente = async (termino, filtro, sede) => {
  let whereColumna;
  if (filtro === 'nombre') {
    whereColumna = `nombre ILIKE $1`;
  } else if (filtro === 'apellido') {
    whereColumna = `apellido ILIKE $1`;
  } else if (filtro === 'cedula') {
    whereColumna = `cedula ILIKE $1`;
  } else {
    whereColumna = `(cedula ILIKE $1 OR nombre ILIKE $1 OR apellido ILIKE $1)`;
  }

  const result = await pool.query(
    `SELECT id_paciente, cedula, nombre, apellido, telefono, status, id_sede
     FROM "Pacientes"
     WHERE ${whereColumna} AND id_sede = $2
     ORDER BY id_paciente DESC
     LIMIT 20`,
    [`%${termino}%`, sede],
  );
  return result.rows;
};

const crearPaciente = async (data) => {
  const result = await pool.query(
    `INSERT INTO "Pacientes" (cedula, nombre, apellido, telefono, status, id_sede)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id_paciente, cedula, nombre, apellido, telefono, status`,
    [data.cedula, data.nombre, data.apellido, data.telefono || null, data.status !== false, data.sede],
  );
  return result.rows[0];
};

const actualizarPaciente = async (id, sede, data) => {
  const result = await pool.query(
    `UPDATE "Pacientes"
     SET cedula = COALESCE($1, cedula),
         nombre = COALESCE($2, nombre),
         apellido = COALESCE($3, apellido),
         telefono = COALESCE($4, telefono)
     WHERE id_paciente = $5 AND id_sede = $6
     RETURNING id_paciente, cedula, nombre, apellido, telefono`,
    [data.cedula, data.nombre, data.apellido, data.telefono, id, sede],
  );
  return result.rows[0] || null;
};

const eliminarPaciente = async (id, sede) => {
  const result = await pool.query(
    'DELETE FROM "Pacientes" WHERE id_paciente = $1 AND id_sede = $2 RETURNING id_paciente',
    [id, sede],
  );
  return result.rowCount > 0;
};

module.exports = {
  buscarPaciente,
  crearPaciente,
  actualizarPaciente,
  eliminarPaciente,
};
