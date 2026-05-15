const pool = require('./backend/src/config/db');
const bcrypt = require('bcryptjs');

async function fix() {
  const hash = await bcrypt.hash('123456', 10);
  const cedula = '0000';
  
  const res = await pool.query('UPDATE "Usuarios" SET password_hash = $1 WHERE cedula = $2', [hash, cedula]);
  
  if (res.rowCount === 0) {
    await pool.query(
      'INSERT INTO "Usuarios" (cedula, password_hash, nombre, apellido, rol, status) VALUES ($1, $2, $3, $4, $5, $6)',
      [cedula, hash, 'Admin', 'Sistema', 'admin', true]
    );
    console.log('ADMIN CREADO EXITOSAMENTE');
  } else {
    console.log('PASSWORD DE ADMIN ACTUALIZADO');
  }
  process.exit();
}

fix().catch(e => { console.error(e); process.exit(1); });
