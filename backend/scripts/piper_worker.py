"""
Worker persistente de Piper TTS.

Carga el modelo de voz UNA sola vez al arrancar y queda escuchando
peticiones por stdin (una por línea, JSON):

  {"id": 1, "texto": "Paciente Juan, acerquese...", "ruta": "C:/.../tts_1.wav"}

Respuesta por stdout (una por línea, JSON):

  {"id": 1, "ok": true}                -> archivo WAV generado
  {"id": 1, "ok": false, "error": "..."} -> fallo

Así se evita el arranque de Python + carga del modelo ONNX (~4-5s) en cada
llamado: el primer anuncio tarda ese tiempo, pero los siguientes salen casi
al instante porque el modelo ya está en memoria.
"""
import json
import os
import sys
import wave

from piper import PiperVoice

MODELO = os.environ.get('PIPER_MODEL')
SENTENCE_SILENCE = float(os.environ.get('PIPER_SENTENCE_SILENCE', '0.2'))


def generar_wav(voz, texto, ruta):
    """Sintetiza `texto` y escribe un WAV de 16 bits PCM en `ruta`."""
    # Nota: en piper 1.7.0 el silencio entre frases lo maneja internamente
    # el modelo (ya no existe `sentence_silence` en SynthesisConfig).
    with wave.open(ruta, 'wb') as wav_file:
        voz.synthesize_wav(texto, wav_file)
    return True


def main():
    if not MODELO or not os.path.exists(MODELO):
        sys.stderr.write('ERROR: PIPER_MODEL no existe: %s\n' % MODELO)
        sys.exit(1)

    # Cargar el modelo una sola vez (esto es lo que tarda ~4-5s)
    voz = PiperVoice.load(MODELO)

    # Señal de listo: el proceso arrancó y el modelo está cargado
    sys.stdout.write(json.dumps({'tipo': 'listo'}) + '\n')
    sys.stdout.flush()

    for linea in sys.stdin:
        linea = linea.strip()
        if not linea:
            continue
        try:
            req = json.loads(linea)
            rid = req.get('id')
            texto = req.get('texto', '')
            ruta = req.get('ruta', '')
            if not texto or not ruta:
                sys.stdout.write(json.dumps({'id': rid, 'ok': False, 'error': 'texto o ruta faltante'}) + '\n')
                sys.stdout.flush()
                continue
            generar_wav(voz, texto, ruta)
            sys.stdout.write(json.dumps({'id': rid, 'ok': True}) + '\n')
            sys.stdout.flush()
        except Exception as e:  # noqa: BLE001 - responder el error al padre
            try:
                sys.stdout.write(json.dumps({'id': rid if 'rid' in locals() else None, 'ok': False, 'error': str(e)}) + '\n')
                sys.stdout.flush()
            except Exception:
                pass


if __name__ == '__main__':
    main()
