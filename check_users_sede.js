
const { Pool } = require('pg');
require('dotenv').config({ path: './backend/.env' });

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function checkUsers() {
  try {
    const res = await pool.query('SELECT id_usuario, rol, nombre, cedula, id_sede FROM "Usuarios"');
    console.log('=== USUARIOS ===');
    console.table(res.rows);
    
    const sedes = await pool.query('SELECT * FROM "Sedes"');
    console.log('=== SEDES ===');
    console.table(sedes.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkUsers();
