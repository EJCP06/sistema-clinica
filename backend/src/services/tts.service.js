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

const ROOT = path.resolve(__dirname, '..', '..', '..');

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
 * Genera un archivo WAV con la síntesis de voz del texto proporcionado.
 *
 * @param {string} texto - Texto a convertir en voz
 * @returns {Promise<string>} Ruta del archivo WAV generado
 */
async function generarAudio(texto) {
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

  const textoFinal = aplicarDiccionario(texto.trim());
  const nombreArchivo = `tts_${Date.now()}.wav`;
  const rutaArchivo = path.join(TEMP_DIR, nombreArchivo);

  try {
    // Worker persistente: carga el modelo UNA vez y atiende todas las
    // peticiones (el primer llamado tarda el arranque ~4-5s, el resto casi
    // al instante). Esto reemplaza al subproceso por-petición que además
    // tenía el `-m` duplicado (rompía el parseo y piper solo sintetizaba
    // "quiet"). Si el worker falla, se reintenta UNA vez con el subproceso
    // clásico antes de rendirse.
    try {
      await piperWorker.sintetizar(textoFinal, rutaArchivo);
    } catch (errWorker) {
      logger.warn(`TTS worker falló, reintentando subproceso: ${errWorker.message}`);
      await new Promise((resolve, reject) => {
        const comando = `"${PIPER_PYTHON}" -m piper -m "${PIPER_MODEL}" -f "${rutaArchivo}" --sentence-silence ${PIPER_SENTENCE_SILENCE}`;
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

module.exports = { generarAudio, limpiarArchivo, aplicarDiccionario };
