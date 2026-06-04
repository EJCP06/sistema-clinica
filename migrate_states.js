const { Pool } = require('pg');
require('dotenv').config({ path: './backend/.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`
});

async function migrateStates() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('--- Iniciando migración de estados (v2: sin FK) ---');

    // 1. Eliminar restricciones de llave foránea temporalmente
    console.log('Eliminando restricciones FK...');
    await client.query('ALTER TABLE "Atencion" DROP CONSTRAINT "Atencion_id_estado_actual_fkey"');
    await client.query('ALTER TABLE "Historial_Atencion" DROP CONSTRAINT "Historial_Atencion_id_estado_fkey"');

    // 2. Mapeo temporal a IDs altos
    console.log('Mapeando registros existentes a IDs temporales...');
    
    // Actualizar Atencion
    await client.query('UPDATE "Atencion" SET id_estado_actual = 101 WHERE id_estado_actual = 1');
    await client.query('UPDATE "Atencion" SET id_estado_actual = 101 WHERE id_estado_actual = 2'); // En presupuesto -> Registrado
    await client.query('UPDATE "Atencion" SET id_estado_actual = 102 WHERE id_estado_actual = 3'); // En Caja -> 102
    await client.query('UPDATE "Atencion" SET id_estado_actual = 103 WHERE id_estado_actual = 4'); // Sala de Espera -> 103
    await client.query('UPDATE "Atencion" SET id_estado_actual = 104 WHERE id_estado_actual = 5'); // Llamado -> 104
    await client.query('UPDATE "Atencion" SET id_estado_actual = 105 WHERE id_estado_actual = 6'); // Atendido -> 105
    await client.query('UPDATE "Atencion" SET id_estado_actual = 107 WHERE id_estado_actual = 7'); // Ausente -> 107
    await client.query('UPDATE "Atencion" SET id_estado_actual = 108 WHERE id_estado_actual = 8'); // Espera de clave -> 108

    // Actualizar Historial
    await client.query('UPDATE "Historial_Atencion" SET id_estado = 101 WHERE id_estado = 1');
    await client.query('UPDATE "Historial_Atencion" SET id_estado = 101 WHERE id_estado = 2');
    await client.query('UPDATE "Historial_Atencion" SET id_estado = 102 WHERE id_estado = 3');
    await client.query('UPDATE "Historial_Atencion" SET id_estado = 103 WHERE id_estado = 4');
    await client.query('UPDATE "Historial_Atencion" SET id_estado = 104 WHERE id_estado = 5');
    await client.query('UPDATE "Historial_Atencion" SET id_estado = 105 WHERE id_estado = 6');
    await client.query('UPDATE "Historial_Atencion" SET id_estado = 107 WHERE id_estado = 7');
    await client.query('UPDATE "Historial_Atencion" SET id_estado = 108 WHERE id_estado = 8');

    console.log('Limpiando tabla Estado...');
    await client.query('DELETE FROM "Estado"');

    console.log('Insertando nuevos estados...');
    const nuevosEstados = [
      [1, 'Registrado'],
      [2, 'En Caja'],
      [3, 'Sala de Espera'],
      [4, 'Llamado'],
      [5, 'Atendido'],
      [7, 'Ausente'],
      [8, 'Espera de clave']
    ];

    for (const [id, nombre] of nuevosEstados) {
      await client.query('INSERT INTO "Estado" (id_estado, nombre_estado) VALUES ($1, $2)', [id, nombre]);
    }

    console.log('Restaurando registros a IDs definitivos...');
    // Actualizar Atencion
    await client.query('UPDATE "Atencion" SET id_estado_actual = 1 WHERE id_estado_actual = 101');
    await client.query('UPDATE "Atencion" SET id_estado_actual = 2 WHERE id_estado_actual = 102');
    await client.query('UPDATE "Atencion" SET id_estado_actual = 3 WHERE id_estado_actual = 103');
    await client.query('UPDATE "Atencion" SET id_estado_actual = 4 WHERE id_estado_actual = 104');
    await client.query('UPDATE "Atencion" SET id_estado_actual = 5 WHERE id_estado_actual = 105');
    await client.query('UPDATE "Atencion" SET id_estado_actual = 7 WHERE id_estado_actual = 107');
    await client.query('UPDATE "Atencion" SET id_estado_actual = 8 WHERE id_estado_actual = 108');

    // Actualizar Historial
    await client.query('UPDATE "Historial_Atencion" SET id_estado = 1 WHERE id_estado = 101');
    await client.query('UPDATE "Historial_Atencion" SET id_estado = 2 WHERE id_estado = 102');
    await client.query('UPDATE "Historial_Atencion" SET id_estado = 3 WHERE id_estado = 103');
    await client.query('UPDATE "Historial_Atencion" SET id_estado = 4 WHERE id_estado = 104');
    await client.query('UPDATE "Historial_Atencion" SET id_estado = 5 WHERE id_estado = 105');
    await client.query('UPDATE "Historial_Atencion" SET id_estado = 7 WHERE id_estado = 107');
    await client.query('UPDATE "Historial_Atencion" SET id_estado = 8 WHERE id_estado = 108');

    console.log('Restaurando restricciones FK...');
    await client.query('ALTER TABLE "Atencion" ADD CONSTRAINT "Atencion_id_estado_actual_fkey" FOREIGN KEY (id_estado_actual) REFERENCES "Estado"(id_estado)');
    await client.query('ALTER TABLE "Historial_Atencion" ADD CONSTRAINT "Historial_Atencion_id_estado_fkey" FOREIGN KEY (id_estado) REFERENCES "Estado"(id_estado)');

    // Sincronizar secuencia
    await client.query("SELECT pg_catalog.setval('public.\"Estado_id_estado_seq\"', 8, true)");

    await client.query('COMMIT');
    console.log('--- Migración completada con éxito ---');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error durante la migración:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

migrateStates();
