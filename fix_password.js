const pool = require('./backend/src/config/db');
const newHash = '$2b$10$AIxEp06G/dV4ILsmiL6jt.J82XoTVmKS/OqiO9y/RMKpKEDssdq1y';
pool.query('UPDATE "Usuarios" SET password_hash = $1 WHERE cedula = $2', [newHash, '12345'])
  .then(() => console.log('CONTRASENA DE MEDICO ACTUALIZADA A: 123456'))
  .catch(e => console.error(e))
  .finally(() => process.exit());
