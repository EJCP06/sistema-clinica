const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function fixAdmin() {
  try {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('123456', salt);
    
    await pool.query(
      'UPDATE "Usuarios" SET password_hash = $1 WHERE username = $2',
      [hash, 'admin']
    );
    
    console.log('--- PASSWORD DE ADMIN ACTUALIZADO ---');
    console.log('Usuario: admin');
    console.log('Password: 123456');
    console.log('Hash generado:', hash);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixAdmin();
