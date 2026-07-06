#!/bin/sh
set -e

export NGINX_DOMAIN="${NGINX_DOMAIN:-localhost}"

envsubst '${NGINX_DOMAIN}' < /etc/nginx/conf.d/default.conf > /tmp/default.conf
mv /tmp/default.conf /etc/nginx/conf.d/default.conf

exec nginx -g "daemon off;"
