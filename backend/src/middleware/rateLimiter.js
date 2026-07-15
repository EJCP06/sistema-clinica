const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60000,
  max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 300,
  message: { mensaje: 'Demasiadas solicitudes. Intente de nuevo más tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => (req.originalUrl || req.path).includes('/turnero/'),
});

const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 3,
  message: { mensaje: 'Demasiados intentos de inicio de sesión. Intente de nuevo en 5 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
  requestWasSuccessful: (req, res) => res.statusCode < 400,
});

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { mensaje: 'Demasiados intentos de verificación. Intente de nuevo en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { apiLimiter, loginLimiter, otpLimiter };
