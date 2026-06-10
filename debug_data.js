const { Pool } = require('pg');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, 'backend/.env') });

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

async function check() {
  try {
    console.log('--- SEDES ---');
    const sedes = await pool.query('SELECT * FROM "Sedes"');
    console.table(sedes.rows);

    console.log('\n--- SERVICIOS ---');
    const servicios = await pool.query('SELECT id_servicio, nombre_servicio, id_sede FROM "Servicio"');
    console.table(servicios.rows);

    console.log('\n--- ESPECIALIDADES ---');
    const especialidades = await pool.query('SELECT id_especialidad, nombre, id_sede, id_servicio FROM "Especialidades"');
    console.table(especialidades.rows);

    console.log('\n--- CONSULTORIOS ---');
    const consultorios = await pool.query('SELECT id_consultorio, nombre, id_sede FROM "Consultorios"');
    console.table(consultorios.rows);

    console.log('\n--- USUARIOS (MÉDICOS) ---');
    const medicos = await pool.query(`
      SELECT u.id_usuario, u.nombre, u.id_sede, r.key as rol 
      FROM "Usuarios" u 
      JOIN "Roles" r ON u.id_rol = r.id_rol 
      WHERE r.key = 'medico'
    `);
    console.table(medicos.rows);

  } catch (err) {
    console.error('ERROR:', err.message);
  } finally {
    await pool.end();
  }
}

check();
