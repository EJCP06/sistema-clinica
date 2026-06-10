const { Pool } = require('pg');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, 'backend/.env') });

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

async function check() {
  try {
    const sede = 1;
    let query = `
      SELECT e.*, e.id_especialidad as id,
             s.nombre_servicio
      FROM "Especialidades" e
      JOIN "Servicio" s ON e.id_servicio = s.id_servicio
    `;
    const params = [];
    
    if (sede) {
      query += ` WHERE e.id_sede = $1`;
      params.push(Number(sede));
    }
    
    query += ` ORDER BY e.nombre ASC`;
    
    console.log('Query:', query);
    console.log('Params:', params);
    
    const result = await pool.query(query, params);
    console.log('Results count:', result.rows.length);
    console.table(result.rows);

  } catch (err) {
    console.error('ERROR:', err.message);
  } finally {
    await pool.end();
  }
}

check();
