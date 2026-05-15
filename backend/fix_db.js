const pool = require('./src/config/db');

async function fix() {
  try {
    console.log('--- Iniciando Reparación de Base de Datos ---');
    await pool.query(`
      ALTER TABLE "Servicio" ADD COLUMN IF NOT EXISTS prefijo VARCHAR(10);
      ALTER TABLE "Servicio" ADD COLUMN IF NOT EXISTS ubicacion VARCHAR(100);
      ALTER TABLE "Servicio" ADD COLUMN IF NOT EXISTS descripcion TEXT;
      ALTER TABLE "Servicio" ADD COLUMN IF NOT EXISTS codigo VARCHAR(20);
    `);
    console.log('✅ Columnas añadidas con éxito a la tabla Servicio');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error reparando DB:', err.message);
    process.exit(1);
  }
}

fix();
