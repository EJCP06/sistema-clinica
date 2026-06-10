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
    console.log('--- VERIFICANDO PACIENTES ---');
    const res = await pool.query('SELECT count(*) FROM "Pacientes"');
    console.log('Total pacientes:', res.rows[0].count);

    console.log('\n--- VERIFICANDO ATENCIONES ---');
    const res2 = await pool.query('SELECT count(*) FROM "Atencion"');
    console.log('Total atenciones:', res2.rows[0].count);

  } catch (err) {
    console.error('ERROR:', err.message);
  } finally {
    await pool.end();
  }
}

check();
