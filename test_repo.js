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

async function test() {
  try {
    console.log('--- Test findByCedula ---');
    // Intentar buscar el admin por defecto
    const cedula = '00000000';
    const result = await pool.query(`
      SELECT u.id_usuario as id, u.cedula, u.password_hash, r.key as rol, u.id_rol, u.nombre, u.apellido,
             u.id_servicio as servicio_id, u.id_consultorio as consultorio_id, u.id_sede,
             u.id_especialidad, e.nombre as especialidad_nombre
      FROM "Usuarios" u
      LEFT JOIN "Roles" r ON u.id_rol = r.id_rol
      LEFT JOIN "Especialidades" e ON u.id_especialidad = e.id_especialidad
      WHERE u.cedula = $1
    `, [cedula]);
    
    if (result.rows.length === 0) {
      console.log('Usuario 00000000 no encontrado, buscando cualquier usuario...');
      const anyUser = await pool.query('SELECT cedula FROM "Usuarios" LIMIT 1');
      if (anyUser.rows.length > 0) {
        const res2 = await pool.query(`
          SELECT u.id_usuario as id, u.cedula, r.key as rol, u.id_rol
          FROM "Usuarios" u
          LEFT JOIN "Roles" r ON u.id_rol = r.id_rol
          WHERE u.cedula = $1
        `, [anyUser.rows[0].cedula]);
        console.log('Resultado usuario:', res2.rows[0]);
      } else {
        console.log('No hay usuarios en la tabla.');
      }
    } else {
      console.log('Usuario admin encontrado:', result.rows[0]);
    }

    console.log('\n--- Test getRoles ---');
    const roles = await pool.query('SELECT * FROM "Roles"');
    console.log('Roles encontrados:', roles.rows.length);

  } catch (err) {
    console.error('ERROR EN QUERY:', err.message);
    console.error('STACK:', err.stack);
  } finally {
    await pool.end();
  }
}

test();
