const pool = require('./src/config/db');

async function main() {
  // Check constraints on Permisos
  const r1 = await pool.query(`
    SELECT column_name, constraint_type 
    FROM information_schema.table_constraints tc 
    JOIN information_schema.key_column_usage kcu 
      ON tc.constraint_name = kcu.constraint_name 
    WHERE tc.table_name = 'Permisos'
  `);
  console.log('Constraints:', JSON.stringify(r1.rows, null, 2));

  // Check existing permissions
  const r2 = await pool.query('SELECT id_permiso, key, nombre FROM "Permisos" ORDER BY id_permiso');
  console.log('Existing permissions:', JSON.stringify(r2.rows, null, 2));

  process.exit();
}

main().catch(e => { console.error(e); process.exit(1); });
