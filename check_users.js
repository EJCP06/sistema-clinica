const pool = require('./backend/src/config/db');
pool.query('SELECT id_usuario, cedula, rol, nombre FROM "Usuarios"')
  .then(r => {
    console.log('--- LISTA DE USUARIOS ---');
    console.table(r.rows);
  })
  .catch(e => console.error(e))
  .finally(() => process.exit());
