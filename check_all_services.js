const { Pool } = require('pg');
require('dotenv').config({ path: './backend/.env' });
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'clinica_colas',
  port: process.env.DB_PORT || 5432,
});

async function run() {
  try {
    const res = await pool.query('SELECT * FROM "Servicio"');
    console.log('Servicios actuales:', res.rows);
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}
run();
