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
