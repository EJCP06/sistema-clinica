const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function cleanupAndReset() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('Eliminando tablas duplicadas y obsoletas...');
    await client.query('DROP TABLE IF EXISTS servicios CASCADE');
    await client.query('DROP TABLE IF EXISTS consultorios CASCADE');
    await client.query('DROP TABLE IF EXISTS usuarios CASCADE');

    console.log('Limpiando tablas reales...');
    await client.query('TRUNCATE "Historial_Atencion", "Atencion", "turnos", "Usuarios", "Consultorios", "Pacientes", "Servicio", "Responsable_Pago", "Estado", "Sedes" CASCADE');

    console.log('Insertando Sedes...');
    await client.query('INSERT INTO "Sedes" (id_sede, nombre) VALUES (1, \'Santa Mónica\'), (2, \'Plaza Sucre\')');

    console.log('Insertando Estados...');
    await client.query('INSERT INTO "Estado" (nombre_estado) VALUES (\'Registro\'), (\'Sala de Espera\'), (\'Llamado\'), (\'En Atención\'), (\'Atendido\'), (\'Ausente\')');

    console.log('Insertando Responsables de Pago...');
    await client.query('INSERT INTO "Responsable_Pago" (nombre) VALUES (\'Particular\'), (\'Seguro Continental\'), (\'Seguro Salud Ya\')');

    console.log('Insertando Servicios...');
    const s1sm = await client.query('INSERT INTO "Servicio" (nombre_servicio, prefijo, id_sede) VALUES (\'Medicina General - SM\', \'MG\', 1) RETURNING id_servicio');
    const s1ps = await client.query('INSERT INTO "Servicio" (nombre_servicio, prefijo, id_sede) VALUES (\'Odontología - PS\', \'OD\', 2) RETURNING id_servicio');

    const idSm = s1sm.rows[0].id_servicio;
    const idPs = s1ps.rows[0].id_servicio;

    console.log('Insertando Consultorios...');
    const c1sm = await client.query('INSERT INTO "Consultorios" (nombre, piso, id_servicio, id_sede) VALUES (\'Consultorio 1-SM\', 1, $1, 1) RETURNING id_consultorio', [idSm]);
    const c1ps = await client.query('INSERT INTO "Consultorios" (nombre, piso, id_servicio, id_sede) VALUES (\'Consultorio 1-PS\', 1, $1, 2) RETURNING id_consultorio', [idPs]);

    const idCSm = c1sm.rows[0].id_consultorio;
    const idCPs = c1ps.rows[0].id_consultorio;

    console.log('Insertando Usuarios...');
    const pass = '$2b$10$7TfEcOV1HssTSa7kHRa7VOwjK/08UzQnO8NjZTM3RLRa64qiajG5e'; // '123'
    
    await client.query('INSERT INTO "Usuarios" (cedula, password_hash, rol, nombre, apellido, id_sede) VALUES (\'0001\', $1, \'admin\', \'Admin\', \'Santa Monica\', 1)', [pass]);
    await client.query('INSERT INTO "Usuarios" (cedula, password_hash, rol, nombre, apellido, id_sede) VALUES (\'0002\', $1, \'admin\', \'Admin\', \'Plaza Sucre\', 2)', [pass]);

    await client.query('INSERT INTO "Usuarios" (cedula, password_hash, rol, nombre, apellido, id_sede, id_servicio, id_consultorio, piso) VALUES (\'1001\', $1, \'medico\', \'Dr. SM\', \'Perez\', 1, $2, $3, 1)', [pass, idSm, idCSm]);
    await client.query('INSERT INTO "Usuarios" (cedula, password_hash, rol, nombre, apellido, id_sede, id_servicio, id_consultorio, piso) VALUES (\'2001\', $1, \'medico\', \'Dra. PS\', \'Lopez\', 2, $2, $3, 1)', [pass, idPs, idCPs]);

    console.log('Insertando Pacientes y Turnos...');
    await client.query('INSERT INTO "Pacientes" (cedula, nombre, apellido, id_sede) VALUES (\'1111\', \'Paciente\', \'SM\', 1)');
    await client.query('INSERT INTO turnos (numero, estado, servicio_id, id_sede, nombre_paciente, documento_paciente) VALUES (\'MG-001\', \'EN_ESPERA\', $1, 1, \'Paciente SM\', \'1111\')', [idSm]);

    await client.query('INSERT INTO "Pacientes" (cedula, nombre, apellido, id_sede) VALUES (\'2222\', \'Paciente\', \'PS\', 2)');
    await client.query('INSERT INTO turnos (numero, estado, servicio_id, id_sede, nombre_paciente, documento_paciente) VALUES (\'OD-001\', \'EN_ESPERA\', $1, 2, \'Paciente PS\', \'2222\')', [idPs]);

    await client.query('COMMIT');
    console.log('RESETEO Y LIMPIEZA EXITOSA');
    console.log('-----------------------------------');
    console.log('Admin SM: 0001 | Pass: 123');
    console.log('Admin PS: 0002 | Pass: 123');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

cleanupAndReset();
