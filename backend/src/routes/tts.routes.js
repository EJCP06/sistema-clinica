/**
 * Rutas PÚBLICAS de Text-to-Speech (TTS).
 *
 * IMPORTANTE: estas rutas NO requieren autenticación — el turnero es una
 * pantalla pública. El rate limiter general de la API las excluye
 * (ver rateLimiter.js).
 *
 * Endpoints:
 *   POST /        -> Genera audio WAV a partir de texto
 *   GET  /audio/:archivo -> Sirve un WAV pre-generado (para sincronización)
 *   GET  /health  -> Verifica que el servicio TTS esté disponible
 */
const express = require('express');
const router = express.Router();
const logger = require('../config/logger');
const ttsService = require('../services/tts.service');

/**
 * GET /api/tts/audio/:archivo
 * Sirve un archivo WAV previamente generado por Piper.
 * Se usa para que todos los turneros reproduzcan el mismo audio
 * simultáneamente (pre-sintetizado por el controller antes del socket emit).
 */
router.get('/audio/:archivo', (req, res) => {
  const { archivo } = req.params;
  if (!archivo || !/^[a-zA-Z0-9_-]+\.wav$/.test(archivo)) {
    return res.status(400).json({ mensaje: 'Nombre de archivo inválido' });
  }
  const rutaArchivo = ttsService.rutaAudioTemporal(archivo);
  if (!ttsService.servirAudio(res, rutaArchivo)) {
    return res.status(404).json({ mensaje: 'Audio no encontrado' });
  }
});

/**
 * POST /api/tts
 * Body: { "texto": "Paciente Juan Pérez diríjase al consultorio 3" }
 * Response: Audio WAV (Content-Type: audio/wav)
 */
router.post('/', async (req, res) => {
  try {
    const { texto } = req.body;

    if (!texto || typeof texto !== 'string' || texto.trim().length === 0) {
      return res.status(400).json({ mensaje: 'El campo "texto" es requerido y no puede estar vacío' });
    }

    if (texto.length > 500) {
      return res.status(400).json({ mensaje: 'El texto no puede exceder 500 caracteres' });
    }

    const rutaArchivo = await ttsService.generarAudio(texto);

    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    const stream = require('fs').createReadStream(rutaArchivo);
    stream.pipe(res);
    stream.on('end', () => {
      ttsService.limpiarArchivo(rutaArchivo);
    });
    stream.on('error', (err) => {
      logger.error('Error enviando audio TTS:', err.message);
      ttsService.limpiarArchivo(rutaArchivo);
      if (!res.headersSent) {
        res.status(500).json({ mensaje: 'Error al generar audio' });
      }
    });
  } catch (error) {
    logger.error('Error en endpoint TTS:', error.message);
    if (!res.headersSent) {
      res.status(503).json({ mensaje: 'Servicio TTS no disponible', detalle: error.message });
    }
  }
});

/**
 * GET /api/tts/health
 * Verifica que el servicio TTS esté operativo.
 */
router.get('/health', (req, res) => {
  const fs = require('fs');
  const path = require('path');
  const rutaModelo = process.env.PIPER_MODEL || path.resolve(__dirname, '..', '..', '..', 'piper', 'models', 'es_MX-claude-high.onnx');
  // Las rutas relativas (p. ej. "./piper/...") se resuelven contra la raíz
  const rutaResuelta = path.isAbsolute(rutaModelo) ? rutaModelo : path.resolve(__dirname, '..', '..', '..', rutaModelo);
  const modeloExiste = fs.existsSync(rutaResuelta);
  res.json({ status: modeloExiste ? 'ok' : 'error', servicio: 'piper-tts', modelo: 'es_MX-claude-high', disponible: modeloExiste });
});

module.exports = router;
