/**
 * Script para generar src/environments/environment.capacitor.ts
 * a partir de las variables de entorno en .env.capacitor
 *
 * Uso: node scripts/build-capacitor-env.js
 *
 * Este script lee .env.capacitor (que NO se sube a Git) y genera
 * el archivo environment.capacitor.ts con las URLs reales.
 */

const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.capacitor');
const outputPath = path.join(__dirname, '..', 'src', 'environments', 'environment.capacitor.ts');

// Valores por defecto (desarrollo local)
const defaults = {
  CAPACITOR_API_URL: 'https://cola-cat.clinicanuevacaracas.net/api',
  CAPACITOR_SOCKET_URL: 'https://cola-cat.clinicanuevacaracas.net',
  CAPACITOR_API_URL_FALLBACK: 'http://192.168.16.37:3001/api',
  CAPACITOR_SOCKET_URL_FALLBACK: 'http://192.168.16.37:3001',
};

// Leer .env.capacitor si existe
let envVars = { ...defaults };

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        envVars[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
  console.log('✓ Archivo .env.capacitor cargado');
} else {
  console.log('⚠ No se encontró .env.capacitor, usando valores por defecto');
  console.log('  Crea .env.capacitor desde .env.capacitor.example');
}

// Generar environment.capacitor.ts
const content = `/**
 * Entorno para Capacitor (Android/iOS).
 *
 * GENERADO AUTOMÁTICAMENTE por scripts/build-capacitor-env.js
 * NO EDITAR MANUALMENTE - Modificar .env.capacitor y ejecutar:
 *   node scripts/build-capacitor-env.js
 *
 * Intenta primero el dominio público. Si no responde en 3 segundos,
 * cambia a la IP interna del servidor (funciona en la red de la clínica).
 */
export const environment = {
  production: true,
  apiUrl: '${envVars.CAPACITOR_API_URL}',
  socketUrl: '${envVars.CAPACITOR_SOCKET_URL}',
  socketTransports: ['polling', 'websocket'] as const,
  // Fallback: IP interna del servidor en la clínica
  apiUrlFallback: '${envVars.CAPACITOR_API_URL_FALLBACK}',
  socketUrlFallback: '${envVars.CAPACITOR_SOCKET_URL_FALLBACK}',
};
`;

fs.writeFileSync(outputPath, content, 'utf-8');
console.log(`✓ ${outputPath} generado correctamente`);
