const { Pool } = require('pg');
require('dotenv').config({ path: './backend/.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`
});

async function restoreStates() {
  try {
    console.log('Restaurando estados originales...');
    
    // Limpiar para evitar conflictos de IDs
    await pool.query('DELETE FROM "Historial_Atencion"');
    await pool.query('UPDATE "Atencion" SET id_estado_actual = NULL');
    await pool.query('DELETE FROM "Estado"');
    
    // Insertar estados originales
    await pool.query(`
      INSERT INTO "Estado" (id_estado, nombre_estado) VALUES 
      (1, 'Registrado'),
      (2, 'Sala de Espera'),
      (3, 'Llamado'),
      (4, 'En Atención'),
      (5, 'Atendido'),
      (6, 'Ausente'),
      (7, 'Transferido')
    `);
    
    // Resetear las atenciones de prueba a estado 2 (Sala de Espera) para que sean visibles
    await pool.query('UPDATE "Atencion" SET id_estado_actual = 2 WHERE id_estado_actual IS NULL');
    
    const res = await pool.query('SELECT * FROM "Estado" ORDER BY id_estado');
    console.log('Estados restaurados:', res.rows);
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

restoreStates();
