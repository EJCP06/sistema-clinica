/**
 * Limitadores de tasa (rate limiting) para proteger la API de abusos.
 *
 * - apiLimiter:  límite general de la API (300 req/min por IP), con valores
 *                configurables vía RATE_LIMIT_WINDOW_MS y RATE_LIMIT_MAX.
 *                El turnero público (/turnero/*) se excluye porque es una
 *                pantalla que consulta constantemente el estado.
 * - loginLimiter: 3 intentos de login cada 5 minutos por IP. El contador se
 *                reinicia cuando la petición tiene éxito (status < 400).
 * - otpLimiter:   5 verificaciones OTP cada 15 minutos (recuperación de contraseña).
 *
 * Los mensajes de error van en español para el usuario final.
 */
const rateLimit = require('express-rate-limit');

// Límite general de la API (no aplica a /turnero/*, que consulta el estado constantemente).
const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60000,
  max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 300,
  message: { mensaje: 'Demasiadas solicitudes. Intente de nuevo más tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => (req.originalUrl || req.path).includes('/turnero/'),
});

// Protege el endpoint de login contra fuerza bruta; el contador se resetea tras un login exitoso.
const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 3,
  message: { mensaje: 'Demasiados intentos de inicio de sesión. Intente de nuevo en 5 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
  requestWasSuccessful: (req, res) => res.statusCode < 400,
});

// Limita los intentos de validación de OTP en el flujo de recuperación de contraseña.
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { mensaje: 'Demasiados intentos de verificación. Intente de nuevo en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { apiLimiter, loginLimiter, otpLimiter };
