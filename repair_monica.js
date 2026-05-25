const { Pool } = require('pg');
require('dotenv').config({ path: './backend/.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`
});

async function repairMonica() {
  try {
    console.log('--- REPARANDO TICKET DE MÓNICA ---');
    
    // Forzamos a que TODOS los tickets de Monica en Sala de Espera (3)
    // tengan Servicio 1 y Especialidad 4
    const res = await pool.query(`
      UPDATE "Atencion" 
      SET id_servicio = 1, id_especialidad = 4 
      WHERE id_paciente IN (SELECT id_paciente FROM "Pacientes" WHERE UPPER(nombre) = 'MONICA')
      AND id_estado_actual = 3
      RETURNING id_atencion, id_servicio, id_especialidad
    `);
    
    console.log('Tickets reparados:', res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

repairMonica();
