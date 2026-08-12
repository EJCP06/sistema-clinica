const pool = require('../config/db');

const findByCedula = async (cedula, sede) => {
  const result = await pool.query(
    'SELECT * FROM "Pacientes" WHERE cedula = $1 AND id_sede = $2',
    [cedula, sede]
  );
  return result.rows[0];
};

const buscarPaciente = async (termino, filtro, sede) => {
  let whereColumna;
  if (filtro === 'nombre') {
    whereColumna = `(primer_nombre ILIKE $1 OR segundo_nombre ILIKE $1)`;
  } else if (filtro === 'apellido') {
    whereColumna = `(primer_apellido ILIKE $1 OR segundo_apellido ILIKE $1)`;
  } else if (filtro === 'cedula') {
    whereColumna = `cedula ILIKE $1`;
  } else {
    whereColumna = `(cedula ILIKE $1 OR primer_nombre ILIKE $1 OR segundo_nombre ILIKE $1 OR primer_apellido ILIKE $1 OR segundo_apellido ILIKE $1)`;
  }

  const result = await pool.query(
    `SELECT id_paciente, cedula, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, fecha_nacimiento, primer_nombre AS nombre, primer_apellido AS apellido, telefono, status, id_sede
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
    `INSERT INTO "Pacientes" (cedula, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, fecha_nacimiento, telefono, status, id_sede)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id_paciente, cedula, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, fecha_nacimiento, primer_nombre AS nombre, primer_apellido AS apellido, telefono, status`,
    [data.cedula, data.primer_nombre, data.segundo_nombre || null, data.primer_apellido, data.segundo_apellido || null, data.fecha_nacimiento || null, data.telefono || null, data.status !== false, data.sede],
  );
  return result.rows[0];
};

const actualizarPaciente = async (id, sede, data) => {
  const result = await pool.query(
    `UPDATE "Pacientes"
     SET cedula = COALESCE($1, cedula),
         primer_nombre = COALESCE($2, primer_nombre),
         segundo_nombre = COALESCE($3, segundo_nombre),
         primer_apellido = COALESCE($4, primer_apellido),
         segundo_apellido = COALESCE($5, segundo_apellido),
         fecha_nacimiento = COALESCE($6, fecha_nacimiento),
         telefono = COALESCE($7, telefono)
     WHERE id_paciente = $8 AND id_sede = $9
     RETURNING id_paciente, cedula, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, fecha_nacimiento, primer_nombre AS nombre, primer_apellido AS apellido, telefono`,
    [data.cedula, data.primer_nombre, data.segundo_nombre || null, data.primer_apellido, data.segundo_apellido || null, data.fecha_nacimiento || null, data.telefono, id, sede],
  );
  return (result.rows && result.rows[0]) || null;
};

const eliminarPaciente = async (id, sede, client = null) => {
  const db = client || pool;
  const result = await db.query(
    'DELETE FROM "Pacientes" WHERE id_paciente = $1 AND id_sede = $2 RETURNING id_paciente',
    [id, sede],
  );
  return result.rowCount > 0;
};

module.exports = {
  findByCedula,
  buscarPaciente,
  crearPaciente,
  actualizarPaciente,
  eliminarPaciente,
};
