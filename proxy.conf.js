const PROXY_CONFIG = {
  "/api": {
    "target": "http://127.0.0.1:3001",
    "secure": false,
    "changeOrigin": true,
    "onProxyRes": (proxyRes, req, res) => {
      // Opcional: Manejo de respuestas
    },
    "onError": (err, req, res) => {
      if (err.code === 'ECONNRESET') {
        // Silenciar errores de conexión resetada que son comunes en desarrollo
        return;
      }
    }
  },
  "/socket.io": {
    "target": "http://127.0.0.1:3001",
    "secure": false,
    "changeOrigin": true,
    "ws": true,
    "onError": (err, req, res) => {
      if (err.code === 'ECONNRESET') {
        // Silenciar errores de WebSocket resetada
        return;
      }
    }
  }
};

module.exports = PROXY_CONFIG;
