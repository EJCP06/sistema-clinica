const pool = require('./src/config/db');

if (process.env.NODE_ENV !== 'development') {
  console.error('❌ Este script solo puede ejecutarse en entorno de desarrollo.');
  process.exit(1);
}

async function reset() {
  try {
    await pool.query("UPDATE configuraciones SET valor = 'false' WHERE clave = 'sistema_cerrado'");
    const res = await pool.query('SELECT * FROM configuraciones');
    console.log('Config after reset:', res.rows);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error al resetear la configuración:', err);
    process.exit(1);
  }
}
reset();
