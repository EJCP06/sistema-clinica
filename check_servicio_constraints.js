
const { Pool } = require('pg');
require('dotenv').config({ path: './backend/.env' });

const pool = new Pool({
  user: process.env.DB_USER, host: process.env.DB_HOST, database: process.env.DB_NAME, password: process.env.DB_PASSWORD, port: process.env.DB_PORT
});

async function check() {
  const res = await pool.query("SELECT constraint_name, table_name FROM information_schema.table_constraints WHERE table_name='Servicio'");
  console.table(res.rows);
  await pool.end();
}
check();
