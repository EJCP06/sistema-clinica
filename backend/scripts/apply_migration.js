const fs = require('fs');
const path = require('path');
const pool = require('../src/config/db');

async function run() {
  try {
    const sqlPath = path.resolve(__dirname, '../db/migrations/004_remove_notificaciones_sms.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log('Ejecutando migración:', sqlPath);
    await pool.query('BEGIN');
    await pool.query(sql);
    await pool.query('COMMIT');
    console.log('Migración ejecutada correctamente.');
  } catch (err) {
    console.error('Error ejecutando migración:', err.message || err);
    try { await pool.query('ROLLBACK'); } catch (e) {}
    process.exitCode = 1;
  } finally {
    // cerrar pool
    await pool.end();
  }
}

run();
