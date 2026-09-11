/**
 * Genera los contratos del backend a partir de los DTO del frontend.
 *
 * FUENTE ÚNICA DE VERDAD: `src/app/core/models/dto.models.ts` (Angular).
 * Este script lo lee y escribe `backend/src/contracts/dto.contracts.js` con
 * un `@typedef` de JSDoc por interfaz, de modo que el backend (JavaScript)
 * tenga documentados y tipados los mismos campos que consume el frontend.
 *
 * Uso:
 *   node scripts/gen-contratos.js           -> escribe el archivo generado
 *   node scripts/gen-contratos.js --check   -> falla si está desincronizado
 *
 * El modo --check se ejecuta en CI, así que cualquier cambio en los DTO que
 * no se refleje en el backend rompe el pipeline: los errores de contrato se
 * detectan antes de llegar a producción.
 */

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const FUENTE = path.join(RAIZ, 'src', 'app', 'core', 'models', 'dto.models.ts');
const DESTINO = path.join(RAIZ, 'backend', 'src', 'contracts', 'dto.contracts.js');

/**
 * Extrae las interfaces exportadas de un archivo TypeScript junto con sus
 * propiedades de primer nivel (las claves del contrato de la API).
 * Las propiedades anidadas se resumen como `Object`.
 */
function extraerInterfaces(codigo) {
  const interfaces = [];
  const cabecera = /^export interface (\w+)[^{]*\{/gm;
  let match;

  while ((match = cabecera.exec(codigo)) !== null) {
    const nombre = match[1];
    const inicioCuerpo = codigo.indexOf('{', match.index);

    // Localiza la llave de cierre que corresponde a esta interfaz
    let profundidad = 0;
    let fin = inicioCuerpo;
    for (; fin < codigo.length; fin++) {
      if (codigo[fin] === '{') profundidad++;
      else if (codigo[fin] === '}') {
        profundidad--;
        if (profundidad === 0) break;
      }
    }

    const cuerpo = codigo.slice(inicioCuerpo + 1, fin);
    const propiedades = [];
    let nivel = 0;

    for (const linea of cuerpo.split('\n')) {
      const texto = linea.trim();
      const esComentario =
        !texto || texto.startsWith('//') || texto.startsWith('/*') || texto.startsWith('*');

      if (nivel === 0 && !esComentario && !texto.startsWith('}')) {
        const prop = texto.match(/^([A-Za-z_$][\w$]*)\s*(\?)?\s*:\s*(.+)$/);
        if (prop) {
          propiedades.push({
            nombre: prop[1],
            opcional: Boolean(prop[2]),
            tipo: mapearTipo(prop[3]),
          });
        }
      }

      nivel += (linea.match(/\{/g) || []).length - (linea.match(/\}/g) || []).length;
    }

    interfaces.push({ nombre, propiedades });
  }

  return interfaces;
}

/** Traduce un tipo TypeScript a un tipo JSDoc equivalente (o `*` si es complejo). */
function mapearTipo(ts) {
  const tipo = ts.replace(/;+\s*$/, '').trim();

  if (tipo.startsWith('{')) return 'Object';
  if (/^Array</.test(tipo) || tipo.endsWith('[]')) return 'Array';

  const primitivos = new Set([
    'string',
    'number',
    'boolean',
    'null',
    'undefined',
    'Object',
    'Array',
  ]);
  const partes = tipo.split('|').map((p) => p.trim());

  const traducidos = partes.map((p) => {
    if (primitivos.has(p)) return p;
    if (p.endsWith('[]') || /^Array</.test(p)) return 'Array';
    if (p.startsWith('{')) return 'Object';
    return '*';
  });

  return traducidos.join('|');
}

/** Construye el contenido completo del archivo de contratos. */
function generarContenido(interfaces) {
  const cabecera = [
    '/**',
    ' * CONTRATOS DE LA API - ARCHIVO GENERADO, NO EDITAR A MANO.',
    ' *',
    ' * Se genera desde src/app/core/models/dto.models.ts (frontend Angular),',
    ' * que es la fuente unica de verdad, ejecutando:',
    ' *',
    ' *   npm run contratos',
    ' *',
    ' * CI ejecuta "npm run contratos:check" y falla si este archivo quedo',
    ' * desincronizado respecto a los DTO del frontend, de modo que un cambio de',
    ' * contrato no pase inadvertido entre el backend y la interfaz.',
    ' *',
    ' * Los @typedef permiten que el editor de autocompletado y avisos de tipo en',
    ' * el backend JavaScript: basta anotar una variable con',
    ' *   @type {import("./dto.contracts").AdmisionDTO}',
    ' */',
    '',
    'module.exports = {};',
    '',
  ].join('\n');

  const bloques = interfaces.map(({ nombre, propiedades }) => {
    const lineas = propiedades.map((p) => {
      const tipo = p.opcional ? `${p.tipo}|undefined` : p.tipo;
      return ` * @property {${tipo}} ${p.nombre}`;
    });

    return `\n/**\n * ${nombre}\n *\n${lineas.join('\n')}\n */\n`;
  });

  return `${cabecera}${bloques.join('')}`;
}

function normalizar(texto) {
  return texto.replace(/\r\n/g, '\n').trim();
}

function main() {
  const modoCheck = process.argv.includes('--check');

  if (!fs.existsSync(FUENTE)) {
    console.error(`✖ No se encontró la fuente de contratos: ${path.relative(RAIZ, FUENTE)}`);
    process.exit(1);
  }

  const interfaces = extraerInterfaces(fs.readFileSync(FUENTE, 'utf-8'));

  if (interfaces.length === 0) {
    console.error('✖ No se extrajo ninguna interfaz: revisa el formato de dto.models.ts');
    process.exit(1);
  }

  const contenido = generarContenido(interfaces);

  if (modoCheck) {
    if (!fs.existsSync(DESTINO)) {
      console.error('✖ Falta backend/src/contracts/dto.contracts.js. Ejecuta: npm run contratos');
      process.exit(1);
    }

    const actual = normalizar(fs.readFileSync(DESTINO, 'utf-8'));
    if (actual !== normalizar(contenido)) {
      console.error('✖ Los contratos del backend están DESINCRONIZADOS con los DTO del frontend.');
      console.error('  Ejecuta: npm run contratos');
      process.exit(1);
    }

    console.log(`✓ Contratos sincronizados (${interfaces.length} interfaces)`);
    return;
  }

  fs.mkdirSync(path.dirname(DESTINO), { recursive: true });
  fs.writeFileSync(DESTINO, contenido, 'utf-8');
  console.log(`✓ ${path.relative(RAIZ, DESTINO)} generado (${interfaces.length} interfaces)`);
}

main();
