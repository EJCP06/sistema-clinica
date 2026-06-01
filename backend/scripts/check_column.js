const pool = require('../src/config/db');

async function check() {
  try {
    const res = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='Pacientes' AND column_name='notificaciones_sms'`);
    if (res.rows.length === 0) {
      console.log('OK: columna notificaciones_sms NO existe.');
    } else {
      console.log('ALERTA: columna notificaciones_sms sigue presente:', res.rows);
    }
  } catch (err) {
    console.error('Error al verificar columna:', err.message || err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

check();
