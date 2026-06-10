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
    const sede = 1;
    console.log('--- TEST QUERY ATENCIONES ---');
    const res = await pool.query(
      `SELECT
        a.id_atencion, a.hora_llegada, a.id_estado_actual,
        p.nombre, s.nombre_servicio
      FROM "Atencion" a
      JOIN "Pacientes" p ON a.id_paciente = p.id_paciente
      JOIN "Servicio" s ON a.id_servicio = s.id_servicio
      WHERE a.id_sede = $1 AND a.hora_llegada::date = CURRENT_DATE
      ORDER BY a.hora_llegada DESC`,
      [sede]
    );
    console.log('Atenciones en sede 1 hoy:', res.rows.length);
    console.table(res.rows);

  } catch (err) {
    console.error('ERROR:', err.message);
  } finally {
    await pool.end();
  }
}

check();
