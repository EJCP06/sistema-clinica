const { Pool } = require('pg');
require('dotenv').config({ path: './backend/.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`
});

async function checkMonica() {
  try {
    const res = await pool.query(`
      SELECT a.id_atencion, a.id_estado_actual, e.nombre_estado, a.id_consultorio, a.hora_salida, p.nombre
      FROM "Atencion" a
      JOIN "Pacientes" p ON a.id_paciente = p.id_paciente
      JOIN "Estado" e ON a.id_estado_actual = e.id_estado
      WHERE UPPER(p.nombre) = 'MONICA'
    `);
    
    console.log('Estado actual de Monica en DB:');
    console.table(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkMonica();
