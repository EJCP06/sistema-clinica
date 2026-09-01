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
import re
import sys
import wave

from piper import PiperVoice
try:
    from piper import espeakbridge
except ImportError:
    espeakbridge = None
try:
    from piper.config import SynthesisConfig
except ImportError:
    SynthesisConfig = None

_DIR = os.path.dirname(os.path.abspath(__file__))
# Detectar raíz: probar 2 niveles (local: backend/scripts → project)
# y 1 nivel (IIS: scripts → project). Se queda con el que tenga piper/.
_project_root = os.path.join(_DIR, '..', '..')
if not os.path.isdir(os.path.join(_project_root, 'piper')):
    _project_root = os.path.join(_DIR, '..')
_ESPEAK_DATA = os.path.join(_project_root, 'piper', 'piper-env', 'Lib', 'site-packages', 'piper', 'espeak-ng-data')

MODELO = os.environ.get('PIPER_MODEL')
SENTENCE_SILENCE = float(os.environ.get('PIPER_SENTENCE_SILENCE', '0.5'))

_espeak_listo = False

# Palabras comunes en español que NO necesitan fonemización.
# Si una palabra está aquí, se deja como texto plano.
# Solo las palabras FUERA de esta lista se envuelven en [[ fonemas ]].
_PALABRAS_COMUNES = {
    'la', 'el', 'los', 'las', 'un', 'una', 'uno', 'del', 'al', 'a', 'de',
    'en', 'por', 'con', 'para', 'se', 'su', 'sus', 'es', 'y', 'o', 'que',
    'no', 'lo', 'le', 'me', 'te', 'nos', 'les', 'da', 'ha', 'hay',
    'este', 'esta', 'estos', 'estas', 'ese', 'esa', 'esos', 'esas',
    'como', 'mas', 'muy', 'bien', 'ya', 'si', 'fue', 'ser', 'tiene',
    'puede', 'tiene', 'hay', 'todo', 'todos', 'toda', 'todas',
    # Palabras del turnero
    'paciente', 'dirijase', 'diríjase', 'consultorio', 'laboratorio',
    'imagenes', 'imágenes', 'recepcion', 'recepción', 'sala', 'espera',
    'numero', 'número', 'turno', 'doctor', 'doctora', 'especialidad',
    'clinica', 'clínica', 'hospital', 'medico', 'médico', 'medica',
    'atencion', 'atención', 'cita', 'historia', 'examen', 'resultado',
    'greso', 'egreso', 'emergencia', 'urgencia',
    'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez',
    'once', 'doce', 'trece', 'catorce', 'quince', 'veinte',
    'aps', 'seguro', 'particular', 'privado',
}


def phonemizar_texto(texto):
    """Convierte cada palabra del texto a fonemas IPA y la envuelve en [[ ]].
    Las palabras comunes del diccionario se dejan como texto plano.
    Esto permite que espeak-ng corrija la pronunciación de nombres
    automáticamente, sin necesidad de un diccionario manual."""
    global _espeak_listo
    if espeakbridge is None:
        return texto
    try:
        if not _espeak_listo:
            espeakbridge.initialize(_ESPEAK_DATA)
            espeakbridge.set_voice('es')
            _espeak_listo = True

        # Tokenizar: separar palabras y puntuación/espacios
        tokens = re.findall(r"[\wáéíóúñüÁÉÍÓÚÑÜ]+|[^\wáéíóúñüÁÉÍÓÚÑÜ]+", texto)
        resultado = []
        phoneme_buffer = []  # Buffer para unir fonemas consecutivos

        def flush_phonemes():
            """Vacía el buffer de fonemas en un solo bloque [[ ]]."""
            if phoneme_buffer:
                resultado.append('[[ ' + ' '.join(phoneme_buffer) + ' ]]')
                phoneme_buffer.clear()

        for token in tokens:
            # Si es puntuación o espacio: verificar si hay buffer de fonemas activo
            if not re.match(r'[\wáéíóúñüÁÉÍÓÚÑÜ]', token):
                if phoneme_buffer and token.strip() == '':
                    pass  # Espacio entre palabras fonemizadas: omitir, se une con join
                else:
                    # Puntuación o separador: vaciar buffer y agregar tal cual
                    flush_phonemes()
                    resultado.append(token)
                continue
            # Si es palabra común: vaciar buffer de fonemas y agregar como texto
            if token.lower() in _PALABRAS_COMUNES:
                flush_phonemes()
                resultado.append(token)
                continue
            # Palabra desconocida (probable nombre): fonemizar y agregar al buffer
            clauses = espeakbridge.get_phonemes(token)
            fonemas = ''.join([p + t for p, t, _ in clauses]).strip()
            if fonemas:
                phoneme_buffer.append(fonemas)
            else:
                flush_phonemes()
                resultado.append(token)

        flush_phonemes()  # Vaciar lo que quede al final
        return ''.join(resultado)
    except Exception:
        return texto


def generar_wav(voz, texto, ruta):
    """Sintetiza `texto` y escribe un WAV de 16 bits PCM en `ruta`.

    NOTA: NO se usa phonemización. El modelo Piper (es_MX-claude-high)
    ya viene entrenado con su propio procesamiento de texto en español
    mexicano/latinoamericano. La phonemización de espeak-ng usa español
    peninsular (θ para z/c antes de e/i), lo cual suena raro con este modelo.
    """
    texto_procesado = texto.strip()
    with wave.open(ruta, 'wb') as wav_file:
        if SynthesisConfig is not None:
            config = SynthesisConfig(length_scale=1.15)
            voz.synthesize_wav(texto_procesado, wav_file, syn_config=config)
        else:
            voz.synthesize_wav(texto_procesado, wav_file)
    return True


def main():
    if not MODELO or not os.path.exists(MODELO):
        sys.stderr.write('ERROR: PIPER_MODEL no existe: %s\n' % MODELO)
        sys.exit(1)

    # Cargar el modelo una sola vez (esto es lo que tarda ~4-5s)
    voz = PiperVoice.load(MODELO)
    sys.stderr.write('modelo Piper cargado\n')

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
