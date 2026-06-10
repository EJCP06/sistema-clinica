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
    console.log('--- BUSCANDO ATENCIONES DE ISMAEL ---');
    const res = await pool.query(`
      SELECT a.id_atencion, p.nombre, p.apellido, a.id_especialidad, a.id_estado_actual, e.nombre_estado, a.id_consultorio, a.hora_llegada
      FROM "Atencion" a
      JOIN "Pacientes" p ON a.id_paciente = p.id_paciente
      JOIN "Estado" e ON a.id_estado_actual = e.id_estado
      WHERE p.nombre ILIKE '%ISMAEL%'
      ORDER BY a.hora_llegada DESC
      LIMIT 5
    `);
    console.table(res.rows);
  } catch (err) {
    console.error('ERROR:', err.message);
  } finally {
    await pool.end();
  }
}

check();
