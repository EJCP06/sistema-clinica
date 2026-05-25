const { Pool } = require('pg');
require('dotenv').config({ path: './backend/.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`
});

async function fixStates() {
  try {
    console.log('Actualizando nombres de estados...');
    
    await pool.query("UPDATE \"Estado\" SET nombre_estado = 'SALA DE ESPERA' WHERE UPPER(nombre_estado) = 'ESPERA'");
    await pool.query("UPDATE \"Estado\" SET nombre_estado = 'EN ATENCIÓN' WHERE UPPER(nombre_estado) = 'ATENDIENDO'");
    await pool.query("UPDATE \"Estado\" SET nombre_estado = 'ATENDIDO' WHERE UPPER(nombre_estado) = 'FINALIZADO'");
    
    const res = await pool.query('SELECT * FROM "Estado"');
    console.log('Nuevos estados:', res.rows);
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

fixStates();
