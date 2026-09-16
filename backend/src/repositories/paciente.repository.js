/**
 * Repositorio de pacientes (tabla "Pacientes").
 *
 * Los nombres se guardan divididos en primer/segundo nombre y primer/segundo
 * apellido (ver migración 006_dividir_nombres_pacientes). El campo
 * "tipo_documento" permite distinguir entre cédula, pasaporte y RIF.
 *
 * Nota: casi todas las consultas filtran también por id_sede para mantener
 * el aislamiento de datos entre sedes.
 */
const pool = require('../config/db');

const findByCedula = async (cedula, sede, tipoDocumento = 'v') => {
  const result = await pool.query(
    'SELECT * FROM "Pacientes" WHERE cedula = $1 AND id_sede = $2 AND tipo_documento = $3',
    [cedula, sede, tipoDocumento]
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
    `SELECT id_paciente, cedula, tipo_documento, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, fecha_nacimiento, primer_nombre AS nombre, primer_apellido AS apellido, telefono, status, id_sede
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
    `INSERT INTO "Pacientes" (cedula, tipo_documento, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, fecha_nacimiento, telefono, status, id_sede)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id_paciente, cedula, tipo_documento, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, fecha_nacimiento, primer_nombre AS nombre, primer_apellido AS apellido, telefono, status`,
    [data.cedula, data.tipo_documento || 'v', data.primer_nombre, data.segundo_nombre || null, data.primer_apellido, data.segundo_apellido || null, data.fecha_nacimiento || null, data.telefono || null, data.status !== false, data.sede],
  );
  return result.rows[0];
};

const actualizarPaciente = async (id, sede, data) => {
  const result = await pool.query(
    `UPDATE "Pacientes"
     SET cedula = COALESCE($1, cedula),
         tipo_documento = COALESCE($2, tipo_documento),
         primer_nombre = COALESCE($3, primer_nombre),
         segundo_nombre = COALESCE($4, segundo_nombre),
         primer_apellido = COALESCE($5, primer_apellido),
         segundo_apellido = COALESCE($6, segundo_apellido),
         fecha_nacimiento = COALESCE($7, fecha_nacimiento),
         telefono = COALESCE($8, telefono)
     WHERE id_paciente = $9 AND id_sede = $10
     RETURNING id_paciente, cedula, tipo_documento, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, fecha_nacimiento, primer_nombre AS nombre, primer_apellido AS apellido, telefono`,
    [data.cedula, data.tipo_documento, data.primer_nombre, data.segundo_nombre || null, data.primer_apellido, data.segundo_apellido || null, data.fecha_nacimiento || null, data.telefono, id, sede],
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
