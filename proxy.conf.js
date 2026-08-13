/**
 * Proxy de desarrollo de Angular (ng serve).
 *
 * Redirige las peticiones del frontend hacia el backend local:
 *   - /api/*        -> http://127.0.0.1:3001/api/*  (peticiones HTTP REST)
 *   - /socket.io/*  -> http://127.0.0.1:3001/socket.io/*  (WebSocket en tiempo real)
 *
 * Así el frontend usa rutas relativas ('/api') igual que en producción
 * (ver src/environments/environment.ts y nginx.conf). En producción este
 * proxy NO se usa: Nginx hace la misma función de reverso.
 */
const PROXY_CONFIG = {
  "/api": {
    "target": "http://127.0.0.1:3001",
    "secure": false,
    "changeOrigin": true,
    "logLevel": "silent",
    "onError": (err, req, res) => {
      if (err.code === 'ECONNRESET' || err.code === 'ECONNREFUSED') {
        if (res && !res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ mensaje: 'No se puede conectar con el backend en http://127.0.0.1:3001' }));
        }
        return;
      }
    }
  },
  "/socket.io": {
    "target": "http://127.0.0.1:3001",
    "secure": false,
    "changeOrigin": true,
    "ws": true,
    "logLevel": "silent",
    "onError": (err, req, res) => {
      if (err.code === 'ECONNRESET' || err.code === 'ECONNREFUSED') {
        if (res && !res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ mensaje: 'No se puede conectar con el backend en http://127.0.0.1:3001' }));
        }
        return;
      }
    }
  }
};

module.exports = PROXY_CONFIG;
