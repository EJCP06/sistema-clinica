#!/usr/bin/env bash
# ============================================================
#  Iniciar Turnero - modo kiosco SIN clicks (Linux / Raspberry Pi)
# ------------------------------------------------------------
#  Equivalente al .reg de Windows para equipos Linux que
#  manejan el televisor del turnero. Habilita el autoplay de
#  audio (--autoplay-policy=no-user-gesture-required) para
#  que la voz suene automaticamente sin tocar la pantalla.
#
#  USO:
#    ./iniciar-turnero.sh                          -> http://localhost/turnero/1
#    ./iniciar-turnero.sh http://192.168.1.50       -> otra IP / dominio
#    ./iniciar-turnero.sh http://192.168.1.50 2     -> ademas selecciona sede 2
# ============================================================

URL="${1:-http://localhost}"
SEDE="${2:-1}"

# Asegurar que la URL termine en /turnero/<sede>
case "$URL" in
  */turnero) ;;
  */) URL="${URL}turnero" ;;
  *)  URL="${URL}/turnero" ;;
esac
URL="$URL/$SEDE?sala=aps"

# Buscar Chrome / Chromium instalado
CHROME=""
for c in google-chrome google-chrome-stable chromium chromium-browser; do
  if command -v "$c" >/dev/null 2>&1; then
    CHROME="$c"
    break
  fi
done

if [ -z "$CHROME" ]; then
  echo "No se encontro Chrome/Chromium instalado. Instala con: sudo apt install chromium-browser" >&2
  exit 1
fi

exec "$CHROME" \
  --kiosk \
  --autoplay-policy=no-user-gesture-required \
  --disable-session-crashed-bubble \
  --no-first-run \
  "$URL"
