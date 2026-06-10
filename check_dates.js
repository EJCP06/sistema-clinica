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
    console.log('--- FECHAS DE ATENCIONES ---');
    const res = await pool.query(
      `SELECT hora_llegada FROM "Atencion" ORDER BY hora_llegada DESC LIMIT 5`
    );
    console.table(res.rows);

  } catch (err) {
    console.error('ERROR:', err.message);
  } finally {
    await pool.end();
  }
}

check();
