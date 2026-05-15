const pool = require('./src/config/db');

async function check() {
  try {
    // Ver columnas reales de la tabla Servicio
    const cols = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'Servicio' 
      ORDER BY ordinal_position
    `);
    console.log('=== COLUMNAS DE "Servicio" ===');
    cols.rows.forEach(c => console.log(`  ${c.column_name} (${c.data_type})`));

    // Ver datos actuales
    const data = await pool.query('SELECT * FROM "Servicio"');
    console.log('\n=== DATOS ACTUALES ===');
    console.log(`Total registros: ${data.rows.length}`);
    data.rows.forEach(r => console.log(r));

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

check();
