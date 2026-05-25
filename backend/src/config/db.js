
const { Pool } = require('pg');
const path = require('path');
const dotenv = require('dotenv');

// Cargar variables de entorno desde .env en raíz del proyecto
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  max: 20, // Incrementado para manejar más conexiones concurrentes
  idleTimeoutMillis: 30000, // 30 segundos
  connectionTimeoutMillis: 5000 // 5 segundos
});

pool.on('connect', () => {
  if (process.env.NODE_ENV !== 'test') {
    console.log('🔗 Conexión a la base de datos PostgreSQL establecida');
  }
});

pool.on('error', (err) => {
  console.error('❌ Error inesperado en el pool de la base de datos', err);
  // No hacer process.exit aquí, dejar que el manejador global lo gestione
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection en promesa:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
});

module.exports = pool;
