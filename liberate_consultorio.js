const { Pool } = require('pg');
require('dotenv').config({ path: './backend/.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`
});

async function liberateConsultorio() {
  try {
    console.log('Liberando consultorios bloqueados...');
    
    // Resetear todos los consultorios a LIBRE si no tienen una atención activa en estado 3 o 4
    await pool.query(`
      UPDATE "Consultorios"
      SET estado_fisico = 'LIBRE'
      WHERE id_consultorio NOT IN (
        SELECT id_consultorio 
        FROM "Atencion" 
        WHERE id_estado_actual IN (3, 4) AND id_consultorio IS NOT NULL
      )
    `);
    
    const res = await pool.query('SELECT id_consultorio, nombre, estado_fisico FROM "Consultorios"');
    console.log('Estado actual de consultorios:', res.rows);
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

liberateConsultorio();
