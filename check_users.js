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
    console.log('--- TODOS LOS USUARIOS ---');
    const users = await pool.query(`
      SELECT u.id_usuario, u.nombre, u.cedula, u.id_sede, r.key as rol 
      FROM "Usuarios" u 
      JOIN "Roles" r ON u.id_rol = r.id_rol
    `);
    console.table(users.rows);

  } catch (err) {
    console.error('ERROR:', err.message);
  } finally {
    await pool.end();
  }
}

check();
