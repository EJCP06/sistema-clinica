const { Pool } = require('pg');
require('dotenv').config({ path: './backend/.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`
});

async function debugData() {
  try {
    console.log('--- DIAGNÓSTICO DE DATOS ACTUALES ---');
    
    // 1. Ver usuarios médicos
    const usuarios = await pool.query(`
      SELECT u.id_usuario, u.nombre, u.apellido, u.rol, u.cedula, u.id_especialidad, u.id_sede, u.id_consultorio, e.nombre as especialidad
      FROM "Usuarios" u
      LEFT JOIN "Especialidades" e ON u.id_especialidad = e.id_especialidad
      WHERE u.rol = 'medico'
    `);
    console.log('\nUSUARIOS MÉDICOS CONFIGURADOS:');
    console.table(usuarios.rows);

    // Ver consultorios disponibles
    const consultorios = await pool.query('SELECT * FROM "Consultorios"');
    console.log('\nCONSULTORIOS DISPONIBLES:');
    console.table(consultorios.rows);

    // 2. Ver tickets en espera (Sala de Espera = 2)
    const tickets = await pool.query(`
      SELECT a.id_atencion, a.numero, p.nombre as paciente, a.id_especialidad, a.id_sede, e.nombre_estado, esp.nombre as especialidad_ticket
      FROM "Atencion" a
      JOIN "Pacientes" p ON a.id_paciente = p.id_paciente
      JOIN "Estado" e ON a.id_estado_actual = e.id_estado
      LEFT JOIN "Especialidades" esp ON a.id_especialidad = esp.id_especialidad
      WHERE a.hora_salida IS NULL
    `);
    console.log('\nTICKETS ACTIVOS EN EL SISTEMA:');
    console.table(tickets.rows);

    // 3. Ver especialidades
    const especialidades = await pool.query('SELECT id_especialidad, nombre FROM "Especialidades"');
    console.log('\nESPECIALIDADES DISPONIBLES:');
    console.table(especialidades.rows);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

debugData();
