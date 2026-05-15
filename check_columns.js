
const { Pool } = require('pg');
require('dotenv').config({ path: './backend/.env' });

const pool = new Pool({
  user: process.env.DB_USER, host: process.env.DB_HOST, database: process.env.DB_NAME, password: process.env.DB_PASSWORD, port: process.env.DB_PORT
});

async function check() {
  const res = await pool.query("SELECT table_name, column_name FROM information_schema.columns WHERE column_name IN ('id_sede', 'sede_id') AND table_schema='public'");
  console.table(res.rows);
  await pool.end();
}
check();
