const client = require('prom-client');

const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duración de peticiones HTTP en segundos',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total de peticiones HTTP',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
});

/**
 * Middleware que captura métricas de duración y total de peticiones HTTP
 * utilizando prom-client. Se ejecuta al finalizar cada respuesta para
 * registrar método, ruta y código de estado.
 *
 * @param {import('express').Request} req - Petición HTTP
 * @param {import('express').Response} res - Respuesta HTTP
 * @param {import('express').NextFunction} next - Siguiente middleware
 * @returns {void}
 */
const metricsMiddleware = (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || req.path;
    httpRequestDuration.observe({ method: req.method, route, status: res.statusCode }, duration);
    httpRequestsTotal.inc({ method: req.method, route, status: res.statusCode });
  });
  next();
};

/**
 * Handler para el endpoint /metrics que expone las métricas en el
 * formato de texto de Prometheus.
 *
 * @param {import('express').Request} req - Petición HTTP
 * @param {import('express').Response} res - Respuesta HTTP
 * @returns {Promise<void>}
 */
const metricsHandler = async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
};

module.exports = { metricsMiddleware, metricsHandler, register };
