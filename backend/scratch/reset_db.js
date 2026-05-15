const pool = require('../src/config/db');
const fs = require('fs');
const path = require('path');

const runInit = async () => {
  try {
    const sqlPath = path.join(__dirname, '../db/init.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('--- Ejecutando reset de base de datos ---');
    await pool.query(sql);
    console.log('✅ Base de datos reseteada con éxito');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error al resetear la base de datos:', error);
    process.exit(1);
  }
};

runInit();
