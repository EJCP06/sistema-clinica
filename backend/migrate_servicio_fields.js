/**
 * Migration: Add 'piso' and 'consultorio' columns to Servicio table.
 * This is non-destructive - only adds columns if they don't exist.
 */
const pool = require('./src/config/db');

async function migrate() {
  try {
    console.log('🔄 Iniciando migración de tabla Servicio...');

    // Add piso column
    await pool.query(`
      ALTER TABLE "Servicio" 
      ADD COLUMN IF NOT EXISTS "piso" varchar DEFAULT NULL
    `);
    console.log('✅ Columna "piso" verificada/agregada');

    // Add consultorio column (text for multiple consultorio names like "Consultorio 1, Consultorio 3")
    await pool.query(`
      ALTER TABLE "Servicio" 
      ADD COLUMN IF NOT EXISTS "consultorio" varchar DEFAULT NULL
    `);
    console.log('✅ Columna "consultorio" verificada/agregada');

    // Populate from existing Consultorios data
    const existing = await pool.query(`
      SELECT c.id_servicio, c.piso, string_agg(c.nombre, ', ' ORDER BY c.nombre) as consultorios
      FROM "Consultorios" c
      WHERE c.id_servicio IS NOT NULL
      GROUP BY c.id_servicio, c.piso
    `);

    for (const row of existing.rows) {
      await pool.query(
        `
        UPDATE "Servicio" 
        SET piso = $1, consultorio = $2
        WHERE id_servicio = $3 AND (piso IS NULL OR consultorio IS NULL)
      `,
        [String(row.piso), row.consultorios, row.id_servicio],
      );
    }
    console.log(`✅ Migrados ${existing.rows.length} registros desde Consultorios`);

    console.log('🎉 Migración completada exitosamente');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error en migración:', error);
    process.exit(1);
  }
}

migrate();
