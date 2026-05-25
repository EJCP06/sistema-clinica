const { Pool } = require('pg');
require('dotenv').config({ path: './backend/.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`
});

async function migrateStates() {
  try {
    console.log('--- MIGRANDO A NUEVOS ESTADOS CLÍNICOS ---');
    
    await pool.query('BEGIN');

    // 1. Limpiar historial y referencias temporales para evitar conflictos de FK
    await pool.query('DELETE FROM "Historial_Atencion"');
    await pool.query('UPDATE "Atencion" SET id_estado_actual = NULL');
    await pool.query('DELETE FROM "Estado"');
    
    // 2. Insertar los 6 estados definidos por el usuario
    await pool.query(`
      INSERT INTO "Estado" (id_estado, nombre_estado) VALUES 
      (1, 'Registrado'),
      (2, 'En Presupuesto / Caja'),
      (3, 'Sala de Espera'),
      (4, 'En Atención'),
      (5, 'Atendido'),
      (6, 'Ausente')
    `);
    
    // 3. Resetear atenciones existentes a 'Registrado' para empezar de cero con el nuevo flujo
    await pool.query('UPDATE "Atencion" SET id_estado_actual = 1 WHERE id_estado_actual IS NULL');
    
    await pool.query('COMMIT');
    
    const res = await pool.query('SELECT * FROM "Estado" ORDER BY id_estado');
    console.log('Estados actualizados exitosamente:');
    console.table(res.rows);
    
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Error durante la migración:', err);
  } finally {
    await pool.end();
  }
}

migrateStates();
