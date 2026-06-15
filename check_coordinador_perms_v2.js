const pool = require('./backend/src/config/db');

async function check() {
  try {
    const query = `
      SELECT r.nombre as rol, p.key 
      FROM "Roles" r 
      JOIN "Roles_Permisos" rp ON r.id_rol = rp.id_rol 
      JOIN "Permisos" p ON rp.id_permiso = p.id_permiso 
      WHERE r.nombre = 'COORDINADOR'
    `;
    const res = await pool.query(query);
    console.table(res.rows);
  } catch(e) {
    console.error(e);
  }
  process.exit();
}

check();
