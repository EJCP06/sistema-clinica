/**
 * Repositorio de pacientes (tabla "Pacientes").
 *
 * Los nombres se guardan divididos en primer/segundo nombre y primer/segundo
 * apellido (ver migración 006_dividir_nombres_pacientes). El campo
 * "tipo_documento" permite distinguir entre cédula, pasaporte y cedula extranjera.
 *
 * Nota: en la BD la columna se guarda SIEMPRE en mayúsculas (V/E/P) gracias a
 * un trigger (ver migrate.js); aquí se escribe tal cual llega y se devuelve en
 * minúsculas (v/e/p) para que la API y el frontend sigan recibiendo el formato
 * actual. Las comparaciones usan UPPER() para que no falle por el case.
 *
 * Nota: casi todas las consultas filtran también por id_sede para mantener
 * el aislamiento de datos entre sedes.
 */
const pool = require('../config/db');

const findByCedula = async (cedula, sede, tipoDocumento = 'v') => {
  const result = await pool.query(
    'SELECT * FROM "Pacientes" WHERE cedula = $1 AND id_sede = $2 AND tipo_documento = UPPER($3)',
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
    `SELECT id_paciente, cedula, LOWER(tipo_documento) AS tipo_documento, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, fecha_nacimiento, primer_nombre AS nombre, primer_apellido AS apellido, telefono, email, direccion, status, id_sede, sexo, estado_civil, cedula_representante, numero_hijo, nombre_representante, parentesco_representante
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
    `INSERT INTO "Pacientes" (cedula, tipo_documento, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, fecha_nacimiento, telefono, email, direccion, status, id_sede, sexo, estado_civil, cedula_representante, numero_hijo, nombre_representante, parentesco_representante)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
     RETURNING id_paciente, cedula, LOWER(tipo_documento) AS tipo_documento, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, fecha_nacimiento, primer_nombre AS nombre, primer_apellido AS apellido, telefono, email, direccion, status, sexo, estado_civil, cedula_representante, numero_hijo, nombre_representante, parentesco_representante`,
    [data.cedula, data.tipo_documento || 'v', data.primer_nombre, data.segundo_nombre || null, data.primer_apellido, data.segundo_apellido || null, data.fecha_nacimiento || null, data.telefono || null, data.email || null, data.direccion || null, data.status !== false, data.sede, data.sexo || null, data.estado_civil || null, data.cedula_representante || null, data.numero_hijo || null, data.nombre_representante || null, data.parentesco_representante || null],
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
         telefono = COALESCE($8, telefono),
         email = COALESCE($9, email),
         direccion = COALESCE($10, direccion),
         sexo = COALESCE($11, sexo),
         estado_civil = COALESCE($12, estado_civil),
         cedula_representante = COALESCE($13, cedula_representante),
         numero_hijo = COALESCE($14, numero_hijo),
         nombre_representante = COALESCE($15, nombre_representante),
         parentesco_representante = COALESCE($16, parentesco_representante)
     WHERE id_paciente = $17 AND id_sede = $18
     RETURNING id_paciente, cedula, LOWER(tipo_documento) AS tipo_documento, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, fecha_nacimiento, primer_nombre AS nombre, primer_apellido AS apellido, telefono, email, direccion, sexo, estado_civil, cedula_representante, numero_hijo, nombre_representante, parentesco_representante`,
    [data.cedula, data.tipo_documento, data.primer_nombre, data.segundo_nombre || null, data.primer_apellido, data.segundo_apellido || null, data.fecha_nacimiento || null, data.telefono, data.email, data.direccion, data.sexo || null, data.estado_civil || null, data.cedula_representante || null, data.numero_hijo || null, data.nombre_representante || null, data.parentesco_representante || null, id, sede],
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
