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
    const sede = 1; // Probando con sede 1
    console.log('--- TEST QUERY ATENCIONES ---');
    const res = await pool.query(
      `SELECT count(*) FROM "Atencion" WHERE id_sede = $1`,
      [sede]
    );
    console.log('Atenciones en sede 1:', res.rows[0].count);

    const res2 = await pool.query(
      `SELECT count(*) FROM "Atencion" WHERE id_sede = $1 AND hora_llegada >= CURRENT_DATE`,
      [sede]
    );
    console.log('Atenciones en sede 1 hoy:', res2.rows[0].count);

  } catch (err) {
    console.error('ERROR:', err.message);
  } finally {
    await pool.end();
  }
}

check();
