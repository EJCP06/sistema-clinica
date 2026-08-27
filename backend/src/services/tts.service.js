/**
 * Servicio de Text-to-Speech (TTS) usando Piper (offline, neural).
 *
 * Utiliza piper-tts (Python) como subprocess para generar audio WAV.
 * Incluye diccionario de pronunciación para nombres difíciles.
 *
 * Flujo:
 *   1. El frontend envía el texto a POST /api/tts
 *   2. Se aplica el diccionario de pronunciación (reemplazo de nombres)
 *   3. Se ejecuta piper como subprocess con el texto por stdin
 *   4. Se retorna el WAV generado
 */
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const logger = require('../config/logger');
const piperWorker = require('./piperWorker');
const DICCIONARIO = require('../config/diccionario');
const { normalizarNombre } = require('./normalizador-nombres');

// Detectar raíz del proyecto: probar 3 niveles (local: backend/src/services → project)
// y 2 niveles (IIS: src/services → project). Se queda con el que tenga la carpeta piper/.
let ROOT = path.resolve(__dirname, '..', '..', '..');
if (!fs.existsSync(path.join(ROOT, 'piper'))) {
  ROOT = path.resolve(__dirname, '..', '..');
}

// PIPER_PYTHON / PIPER_MODEL pueden venir con rutas relativas ("./piper/...")
// o absolutas según cómo arranque el backend (local, IIS, etc.). Las relativas
// se resuelven contra la raíz del proyecto.
const resolverRuta = (ruta) => {
  if (!ruta) return ruta;
  return path.isAbsolute(ruta) ? ruta : path.resolve(ROOT, ruta);
};

const PIPER_PYTHON = resolverRuta(process.env.PIPER_PYTHON) || path.join(ROOT, 'piper', 'piper-env', 'Scripts', 'python.exe');
const PIPER_MODEL = resolverRuta(process.env.PIPER_MODEL) || path.join(ROOT, 'piper', 'models', 'es_ES-sharvard-medium.onnx');
const PIPER_SENTENCE_SILENCE = process.env.PIPER_SENTENCE_SILENCE || '0.2';
const TEMP_DIR = path.join(ROOT, 'temp');

/**
 * Aplica el diccionario de pronunciación al texto (definido en
 * ../config/diccionario.js). Reemplaza cada palabra clave por su versión
 * fonética. La búsqueda ignora mayúsculas/minúsculas.
 */
function aplicarDiccionario(texto) {
  let resultado = texto;
  for (const [clave, valor] of Object.entries(DICCIONARIO)) {
    resultado = resultado.replace(new RegExp(clave, 'gi'), valor);
  }
  return resultado;
}

/**
 * Aplica el normalizador fonético a cada palabra del texto.
 * Solo normaliza palabras que parecen nombres (primera mayúscula o todo mayúsculas).
 * No toca palabras comunes como "Paciente", "diríjase", etc.
 */
function aplicarNormalizadorFonetico(texto) {
  // Palabras que NO deben ser normalizadas (son parte del texto del llamado)
  const palabrasIgnorar = new Set([
    'paciente', 'turno', 'dirijase', 'diríjase', 'consultorio',
    'laboratorio', 'imagenes', 'imágenes', 'recepcion', 'recepción', 'aps',
    'el', 'la', 'los', 'las', 'un', 'una', 'de', 'del', 'al', 'a', 'en',
    'por', 'con', 'para', 'y', 'o', 'que', 'es', 'segundo', 'primero'
  ]);
  
  // Separar el texto manteniendo espacios
  const tokens = texto.split(/(\s+)/);
  
  const tokensNormalizados = tokens.map(token => {
    // Si es espacio o número, mantener tal cual
    if (/^\s+$/.test(token) || /^\d+$/.test(token)) return token;
    
    // Limpiar puntuación para análisis
    const limpia = token.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ]/g, '');
    
    // Solo normalizar si:
    // 1. Es una palabra que empieza con mayúscula (probable nombre)
    // 2. O es todo mayúsculas
    // 3. Y NO está en la lista de ignorar
    const esPrimeraMayuscula = /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+$/.test(limpia);
    const esTodoMayusculas = /^[A-ZÁÉÍÓÚÑ]+$/.test(limpia) && limpia.length > 2;
    const esIgnorada = palabrasIgnorar.has(limpia.toLowerCase());
    
    if ((esPrimeraMayuscula || esTodoMayusculas) && !esIgnorada && limpia.length > 2) {
      // Aplicar normalizador fonético
      const normalizado = normalizarNombre(token);
      return normalizado;
    }
    
    return token;
  });
  
  return tokensNormalizados.join('');
}

/**
 * Genera un archivo WAV con la síntesis de voz del texto proporcionado.
 *
 * @param {string} texto - Texto a convertir en voz
 * @param {string} [nombrePersonalizado] - Nombre del archivo (sin extensión). Si se omite se genera uno automático.
 * @returns {Promise<string>} Ruta del archivo WAV generado
 */
async function generarAudio(texto, nombrePersonalizado, opts = {}) {
  if (!texto || typeof texto !== 'string' || texto.trim().length === 0) {
    throw new Error('El texto no puede estar vacío');
  }

  if (!fs.existsSync(PIPER_PYTHON)) {
    throw new Error(`Piper no encontrado en: ${PIPER_PYTHON}`);
  }

  if (!fs.existsSync(PIPER_MODEL)) {
    throw new Error(`Modelo de voz no encontrado en: ${PIPER_MODEL}`);
  }

  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }

  // 1. Aplicar diccionario (coincidencia exacta)
  let textoFinal = aplicarDiccionario(texto.trim());
  
  // 2. Aplicar normalizador fonético automático a palabras que no fueron reemplazadas
  // Esto convierte JH→Y, Y→I, W→U, etc. automáticamente
  textoFinal = aplicarNormalizadorFonetico(textoFinal);
  const nombreArchivo = nombrePersonalizado ? `${nombrePersonalizado}.wav` : `tts_${Date.now()}.wav`;
  const rutaArchivo = path.join(TEMP_DIR, nombreArchivo);

  try {
    // Worker persistente: carga el modelo UNA vez y atiende todas las
    // peticiones (el primer llamado tarda el arranque ~4-5s, el resto casi
    // al instante). Esto reemplaza al subproceso por-petición que además
    // tenía el `-m` duplicado (rompía el parseo y piper solo sintetizaba
    // "quiet"). Si el worker falla, se reintenta UNA vez con el subproceso
    // clásico antes de rendirse.
    try {
      await piperWorker.sintetizar(textoFinal, rutaArchivo, opts);
    } catch (errWorker) {
      logger.warn(`TTS worker falló, reintentando subproceso: ${errWorker.message}`);
      await new Promise((resolve, reject) => {
        const comando = `"${PIPER_PYTHON}" -m piper -m "${PIPER_MODEL}" -f "${rutaArchivo}" --sentence-silence ${PIPER_SENTENCE_SILENCE} --length-scale 1.15`;
        const child = exec(comando, {
          timeout: 15000,
          windowsHide: true,
        }, (error) => {
          if (error) {
            reject(new Error(error.message));
            return;
          }
          if (!fs.existsSync(rutaArchivo) || fs.statSync(rutaArchivo).size === 0) {
            reject(new Error('Piper no generó audio'));
            return;
          }
          resolve();
        });
        child.stdin.end(textoFinal);
      });
    }

    if (!fs.existsSync(rutaArchivo) || fs.statSync(rutaArchivo).size === 0) {
      throw new Error('Piper no generó audio');
    }

    return rutaArchivo;
  } catch (error) {
    if (fs.existsSync(rutaArchivo)) {
      fs.unlinkSync(rutaArchivo);
    }
    throw new Error(`Error en Piper: ${error.message}`);
  }
}

/**
 * Elimina un archivo temporal de forma segura.
 */
function limpiarArchivo(rutaArchivo) {
  try {
    if (rutaArchivo && fs.existsSync(rutaArchivo)) {
      fs.unlinkSync(rutaArchivo);
    }
  } catch (err) {
    logger.warn(`No se pudo eliminar archivo temporal TTS: ${rutaArchivo}`, err.message);
  }
}

/**
 * Retorna la ruta absoluta de un archivo temporal de audio generado.
 * Útil para que el controller construya la URL de descarga.
 */
function rutaAudioTemporal(nombreArchivo) {
  return path.join(TEMP_DIR, nombreArchivo);
}

/**
 * Sirve un archivo WAV previamente generado como respuesta HTTP.
 * @param {import('express').Response} res
 * @param {string} rutaArchivo - Ruta absoluta del WAV
 * @returns {boolean} true si se sirvió, false si no existía
 */
function servirAudio(res, rutaArchivo) {
  if (!rutaArchivo || !fs.existsSync(rutaArchivo)) {
    return false;
  }
  res.setHeader('Content-Type', 'audio/wav');
  res.setHeader('Cache-Control', 'public, max-age=30');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const stream = fs.createReadStream(rutaArchivo);
  stream.pipe(res);
  stream.on('error', () => {
    if (!res.headersSent) {
      res.status(500).end();
    }
  });
  return true;
}

/**
 * Elimina archivos temporales TTS más viejos que maxAgeMs (default 60s).
 * Ejecutar periódicamente para evitar acumulación de WAVs.
 */
function limpiarArchivosAntiguos(maxAgeMs = 60000) {
  try {
    if (!fs.existsSync(TEMP_DIR)) return;
    const ahora = Date.now();
    const archivos = fs.readdirSync(TEMP_DIR).filter(f => f.startsWith('tts_') && f.endsWith('.wav'));
    for (const archivo of archivos) {
      const ruta = path.join(TEMP_DIR, archivo);
      try {
        const stat = fs.statSync(ruta);
        if (ahora - stat.mtimeMs > maxAgeMs) {
          fs.unlinkSync(ruta);
        }
      } catch { /* ignorar */ }
    }
  } catch { /* ignorar */ }
}

module.exports = { generarAudio, limpiarArchivo, aplicarDiccionario, rutaAudioTemporal, servirAudio, limpiarArchivosAntiguos };
