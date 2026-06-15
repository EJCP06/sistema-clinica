const pool = require('./backend/src/config/db');

async function check() {
  try {
    const res = await pool.query('SELECT * FROM "Roles"');
    console.table(res.rows);
  } catch(e) {
    console.error(e);
  }
  process.exit();
}

check();
