const pool = require('./backend/src/config/db');

async function checkTables() {
  try {
    const res = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log('Tables:', res.rows.map(r => r.table_name));
    
    const consultoriosCols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'Consultorios'`);
    console.log('Consultorios Columns:', consultoriosCols.rows.map(r => r.column_name));

    const servicioCols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'Servicio'`);
    console.log('Servicio Columns:', servicioCols.rows.map(r => r.column_name));

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkTables();
