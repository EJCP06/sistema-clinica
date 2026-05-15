const pool = require('./src/config/db');

async function updateSchema() {
  const client = await pool.connect();
  try {
    console.log('--- Iniciando actualización de esquema de base de datos ---');
    await client.query('BEGIN');

    // 1. Actualizar tabla Usuarios
    console.log('Actualizando tabla "Usuarios"...');
    await client.query(`
      ALTER TABLE "Usuarios" 
      ADD COLUMN IF NOT EXISTS "id_servicio" integer;
    `);

    // 2. Actualizar tabla Consultorios
    console.log('Actualizando tabla "Consultorios"...');
    await client.query(`
      ALTER TABLE "Consultorios" 
      ADD COLUMN IF NOT EXISTS "piso" varchar;
    `);

    // 3. Actualizar tabla Servicio
    console.log('Actualizando tabla "Servicio"...');
    await client.query(`
      ALTER TABLE "Servicio" 
      ADD COLUMN IF NOT EXISTS "prefijo" varchar,
      ADD COLUMN IF NOT EXISTS "ubicacion" varchar,
      ADD COLUMN IF NOT EXISTS "codigo" varchar,
      ADD COLUMN IF NOT EXISTS "descripcion" text;
    `);

    await client.query('COMMIT');
    console.log('✅ Esquema actualizado exitosamente.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error actualizando el esquema:', error);
  } finally {
    client.release();
    process.exit();
  }
}

updateSchema();
