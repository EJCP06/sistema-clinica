/**
 * Script para generar src/environments/environment.capacitor.ts
 * a partir de las variables de entorno en .env.capacitor
 *
 * Uso: node scripts/build-capacitor-env.js
 *
 * SEGURIDAD: este script NO contiene URLs reales. Las URLs del servidor
 * (dominio público e IP interna) viven únicamente en .env.capacitor, que
 * está en .gitignore y no se versiona. Si el archivo no existe, el script
 * falla en lugar de generar una app Android apuntando a un valor incorrecto.
 */

const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.capacitor');
const examplePath = path.join(__dirname, '..', '.env.capacitor.example');
const outputPath = path.join(__dirname, '..', 'src', 'environments', 'environment.capacitor.ts');

/** Variables obligatorias para construir el entorno de la app móvil. */
const REQUIRED_KEYS = [
  'CAPACITOR_API_URL',
  'CAPACITOR_SOCKET_URL',
  'CAPACITOR_API_URL_FALLBACK',
  'CAPACITOR_SOCKET_URL_FALLBACK',
];

/** Detecta valores que quedaron como marcador de posición del ejemplo. */
const PLACEHOLDER_PATTERN = /(tu-dominio\.example|192\.168\.1\.100)/;

if (!fs.existsSync(envPath)) {
  console.error('✖ ERROR: no se encontró el archivo .env.capacitor');
  console.error('');
  console.error('  Crea el archivo a partir de la plantilla y completa las URLs reales:');
  console.error(`    cp "${path.relative(process.cwd(), examplePath)}" .env.capacitor`);
  console.error('');
  console.error('  Ese archivo NO se versiona (está en .gitignore) y es el único');
  console.error('  lugar donde deben vivir el dominio público y la IP interna.');
  process.exit(1);
}

// Leer y parsear .env.capacitor
const envVars = {};
fs.readFileSync(envPath, 'utf-8')
  .split('\n')
  .forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const separator = trimmed.indexOf('=');
    if (separator === -1) return;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    if (key) envVars[key] = value;
  });

const missing = REQUIRED_KEYS.filter((key) => !envVars[key]);
if (missing.length > 0) {
  console.error(`✖ ERROR: faltan variables en .env.capacitor: ${missing.join(', ')}`);
  console.error('  Revisa la plantilla .env.capacitor.example para ver el formato esperado.');
  process.exit(1);
}

const placeholders = REQUIRED_KEYS.filter((key) => PLACEHOLDER_PATTERN.test(envVars[key]));
if (placeholders.length > 0) {
  console.error(`✖ ERROR: estas variables siguen con valores de ejemplo: ${placeholders.join(', ')}`);
  console.error('  Completa las URLs reales del servidor antes de compilar la app Android.');
  process.exit(1);
}

console.log('✓ Archivo .env.capacitor cargado');

// Generar environment.capacitor.ts
const content = `/**
 * Entorno para Capacitor (Android/iOS).
 *
 * GENERADO AUTOMÁTICAMENTE por scripts/build-capacitor-env.js
 * NO EDITAR MANUALMENTE - Modificar .env.capacitor y ejecutar:
 *   npm run build:capacitor
 *
 * Intenta primero el dominio público. Si no responde en 3 segundos,
 * cambia a la IP interna del servidor (funciona en la red de la clínica).
 */
export const environment = {
  production: true,
  apiUrl: '${envVars.CAPACITOR_API_URL}',
  socketUrl: '${envVars.CAPACITOR_SOCKET_URL}',
  socketTransports: ['polling', 'websocket'] as const,
  // Fallback: IP interna del servidor en la red local de la clínica
  apiUrlFallback: '${envVars.CAPACITOR_API_URL_FALLBACK}',
  socketUrlFallback: '${envVars.CAPACITOR_SOCKET_URL_FALLBACK}',
};
`;

fs.writeFileSync(outputPath, content, 'utf-8');
console.log(`✓ ${path.relative(process.cwd(), outputPath)} generado correctamente`);
