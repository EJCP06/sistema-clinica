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
    console.log('--- Columnas en Usuarios ---');
    const cols = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'Usuarios'
    `);
    cols.rows.forEach(r => console.log(`${r.column_name}: ${r.data_type}`));

    console.log('\n--- Conteo de roles ---');
    const roles = await pool.query('SELECT count(*) FROM "Roles"');
    console.log('Total roles:', roles.rows[0].count);

    console.log('\n--- Muestra de Usuarios (id_rol) ---');
    const users = await pool.query('SELECT id_usuario, cedula, id_rol FROM "Usuarios" LIMIT 5');
    users.rows.forEach(u => console.log(`ID: ${u.id_usuario}, Cedula: ${u.cedula}, id_rol: ${u.id_rol}`));

  } catch (err) {
    console.error('ERROR:', err.message);
  } finally {
    await pool.end();
  }
}

check();
