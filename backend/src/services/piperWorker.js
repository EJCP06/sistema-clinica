/**
 * Cliente del worker persistente de Piper TTS (scripts/piper_worker.py).
 *
 * El worker carga el modelo ONNX UNA sola vez al arrancar y queda escuchando
 * peticiones por stdin/stdout (JSON por línea). Así el primer anuncio tarda
 * el arranque (~4-5s) pero los siguientes salen casi al instante, en vez de
 * lanzar un subproceso Python nuevo (con su carga de modelo) por cada llamado.
 *
 * Si el worker se cae o no responde a tiempo, se mata, se reinicia y la
 * petición falla para que el llamador use el fallback (Web Speech API).
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const logger = require('../config/logger');

const ROOT = path.resolve(__dirname, '..', '..', '..');

// PIPER_PYTHON / PIPER_MODEL pueden venir con rutas relativas ("./piper/...")
// o absolutas según cómo arranque el backend (local, IIS, etc.).
const resolverRuta = (ruta) => {
  if (!ruta) return ruta;
  return path.isAbsolute(ruta) ? ruta : path.resolve(ROOT, ruta);
};

const PIPER_PYTHON = resolverRuta(process.env.PIPER_PYTHON) || path.join(ROOT, 'piper', 'piper-env', 'Scripts', 'python.exe');
const PIPER_MODEL = resolverRuta(process.env.PIPER_MODEL) || path.join(ROOT, 'piper', 'models', 'es_ES-sharvard-medium.onnx');
const PIPER_SENTENCE_SILENCE = process.env.PIPER_SENTENCE_SILENCE || '0.2';

const TIEMPO_ESPERA_MS = 20000;
const TIEMPO_READY_MS = 30000;

class PiperWorker {
  constructor() {
    this.proceso = null;
    this.cola = [];
    this.ready = false;
    this.arrancando = false;
    this.idContador = 0;
    this.enVuelo = false;
  }

  disponible() {
    return fs.existsSync(PIPER_PYTHON) && fs.existsSync(PIPER_MODEL);
  }

  _rutaWorker() {
    const candidatas = [
      path.join(__dirname, '..', '..', 'scripts', 'piper_worker.py'),
      path.join(__dirname, '..', 'scripts', 'piper_worker.py'),
      path.join(ROOT, 'backend', 'scripts', 'piper_worker.py'),
    ];
    for (const c of candidatas) {
      if (fs.existsSync(c)) return c;
    }
    return candidatas[0];
  }

  _arrancar() {
    if (this.proceso || this.arrancando) return;
    this.arrancando = true;
    this.ready = false;

    const script = this._rutaWorker();
    this.proceso = spawn(PIPER_PYTHON, [script], {
      env: {
        ...process.env,
        PIPER_MODEL,
        PIPER_SENTENCE_SILENCE,
        PYTHONIOENCODING: 'utf-8',
      },
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.proceso.stdout.setEncoding('utf-8');
    this.proceso.stderr.setEncoding('utf-8');

    let buffer = '';
    const self = this;

    this.proceso.stdout.on('data', (chunk) => {
      buffer += chunk;
      let idx;
      while ((idx = buffer.indexOf('\n')) >= 0) {
        const linea = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!linea) continue;
        try {
          const msg = JSON.parse(linea);
          if (msg.tipo === 'listo') {
            this.ready = true;
            this.arrancando = false;
            this._desencolar();
          } else if (msg.id !== undefined) {
            const pendiente = this.cola.find((p) => p.id === msg.id);
            if (pendiente) {
              clearTimeout(pendiente.timer);
              this.cola = this.cola.filter((p) => p.id !== msg.id);
              if (msg.ok) {
                pendiente.resolve();
              } else {
                pendiente.reject(new Error(msg.error || 'Error en Piper worker'));
              }
              // Liberar el turno y despachar la siguiente petición en cola
              this.enVuelo = false;
              this._desencolar();
            }
          }
        } catch {
          // línea no JSON (p. ej. aviso de Python): ignorar
        }
      }
    });

    this.proceso.stderr.on('data', (chunk) => {
      if (this.ready) logger.warn(`[piper-worker] ${String(chunk).trim()}`);
    });

    this.proceso.on('exit', (code) => {
      this.proceso = null;
      this.ready = false;
      this.arrancando = false;
      this.enVuelo = false;
      const pendientes = this.cola;
      this.cola = [];
      for (const p of pendientes) {
        clearTimeout(p.timer);
        p.reject(new Error(`Worker de Piper terminó (código ${code})`));
      }
      void self; // (referencia conservada para futuras extensiones)
    });

    this.proceso.on('error', (err) => {
      this.proceso = null;
      this.ready = false;
      this.arrancando = false;
      this.enVuelo = false;
      const pendientes = this.cola;
      this.cola = [];
      for (const p of pendientes) {
        clearTimeout(p.timer);
        p.reject(new Error(`No se pudo arrancar Piper: ${err.message}`));
      }
    });

    // Timeout de arranque: si el modelo tarda demasiado, fallar
    setTimeout(() => {
      if (!this.ready) {
        this._matar();
      }
    }, TIEMPO_READY_MS);
  }

  _matar() {
    if (this.proceso) {
      try { this.proceso.kill(); } catch { /* ya murió */ }
      this.proceso = null;
    }
    this.ready = false;
    this.arrancando = false;
    this.enVuelo = false;
    const pendientes = this.cola;
    this.cola = [];
    for (const p of pendientes) {
      clearTimeout(p.timer);
      p.reject(new Error('Tiempo de espera de Piper agotado'));
    }
  }

  _desencolar() {
    // El worker procesa en serie (un synth a la vez): solo se envía si no hay
    // ninguno en vuelo. Las peticiones de alta prioridad (llamadas de médico)
    // se procesan ANTES que las normales (lab/imag) para que la voz del médico
    // nunca quede bloqueada detrás de un ciclo repetitivo.
    if (!this.ready || this.enVuelo) return;
    // Buscar primero entre los de alta prioridad, luego entre los normales
    const pendiente = this.cola.find((p) => !p.enviado && p.prioridad === 'alta')
      || this.cola.find((p) => !p.enviado);
    if (!pendiente) return;
    pendiente.enviado = true;
    this.enVuelo = true;
    this.proceso.stdin.write(JSON.stringify({
      id: pendiente.id,
      texto: pendiente.texto,
      ruta: pendiente.ruta,
    }) + '\n');
  }

  /**
   * Sintetiza `texto` y escribe el WAV en `ruta`.
   * @param {string} texto - Texto a sintetizar
   * @param {string} ruta - Ruta del archivo WAV de salida
   * @param {object} [opts] - Opciones adicionales
   * @param {string} [opts.prioridad='normal'] - 'alta' para llamadas de médico, 'normal' para lab/imag
   * @returns {Promise<void>}
   */
  sintetizar(texto, ruta, opts = {}) {
    const prioridad = opts.prioridad || 'normal';
    return new Promise((resolve, reject) => {
      const id = ++this.idContador;
      const pendiente = { id, texto, ruta, prioridad, resolve, reject, enviado: false };

      const timer = setTimeout(() => {
        this.cola = this.cola.filter((p) => p.id !== id);
        reject(new Error('Timeout generando audio con Piper'));
        // Si el worker se colgó, matarlo y reiniciar para que
        // siguientes peticiones no queden bloqueadas para siempre.
        if (this.enVuelo) {
          logger.warn('[piper-worker] Timeout: matando worker colgado para reiniciar');
          this._matar();
        }
      }, TIEMPO_ESPERA_MS);
      pendiente.timer = timer;

      this.cola.push(pendiente);
      if (!this.proceso && !this.arrancando) {
        this._arrancar();
      } else {
        this._desencolar();
      }
    });
  }

  cerrar() {
    this._matar();
  }
}

module.exports = new PiperWorker();
