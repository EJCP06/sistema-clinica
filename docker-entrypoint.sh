#!/bin/sh
# ============================================================
# Entrypoint del contenedor web (Nginx).
# ------------------------------------------------------------
# Sustituye la variable ${NGINX_DOMAIN} en nginx.conf (usando envsubst)
# y arranca Nginx en primer plano. NGINX_DOMAIN se define al levantar el
# contenedor (ej. NGINX_DOMAIN=clinica.midominio.com); si no se define,
# usa 'localhost'.
# ============================================================
set -e

export NGINX_DOMAIN="${NGINX_DOMAIN:-localhost}"

envsubst '${NGINX_DOMAIN}' < /etc/nginx/conf.d/default.conf > /tmp/default.conf
mv /tmp/default.conf /etc/nginx/conf.d/default.conf

exec nginx -g "daemon off;"
