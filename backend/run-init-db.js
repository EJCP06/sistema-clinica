
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

if (process.env.NODE_ENV !== 'development') {
  console.error('❌ Este script solo puede ejecutarse en entorno de desarrollo.');
  process.exit(1);
}

async function initDB() {
  // Configuración base (conectamos a 'postgres' por defecto para poder crear la DB si no existe)
  const baseConfig = {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: 'postgres', // nos conectamos a la por defecto
  };

  const clientBase = new Client(baseConfig);

  try {
    console.log('Conectando a PostgreSQL (postgres db)...');
    await clientBase.connect();

    // Comprobar si la base de datos clinica_colas existe
    const res = await clientBase.query(`SELECT datname FROM pg_catalog.pg_database WHERE datname = '${process.env.DB_NAME}'`);
    
    if (res.rowCount === 0) {
      console.log(`La base de datos "${process.env.DB_NAME}" no existe. Creándola...`);
      await clientBase.query(`CREATE DATABASE "${process.env.DB_NAME}"`);
      console.log('Base de datos creada exitosamente.');
    } else {
      console.log(`La base de datos "${process.env.DB_NAME}" ya existe.`);
    }
  } catch (err) {
    console.error('Error al preparar la base de datos:', err);
    process.exit(1);
  } finally {
    await clientBase.end();
  }

  // Ahora conectamos a la base de datos específica
  const targetConfig = {
    ...baseConfig,
    database: process.env.DB_NAME,
  };

  const clientTarget = new Client(targetConfig);

  try {
    console.log(`Conectando a la base de datos "${process.env.DB_NAME}" para ejecutar el script...`);
    await clientTarget.connect();

    const sqlPath = path.resolve(__dirname, 'db', 'init.sql');
    console.log(`Leyendo archivo SQL desde: ${sqlPath}`);
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Ejecutando script SQL...');
    await clientTarget.query(sql);
    console.log('✅ Base de datos inicializada correctamente con tablas y datos de prueba.');

  } catch (err) {
    console.error('❌ Error al ejecutar el script SQL:', err);
  } finally {
    await clientTarget.end();
  }
}

initDB();
