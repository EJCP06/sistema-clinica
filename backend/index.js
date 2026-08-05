const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const http = require('http');
const { Server } = require('socket.io');
const dotenv = require('dotenv');
const path = require('path');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const pool = require('./src/config/db');
const logger = require('./src/config/logger');
const requestId = require('./src/middleware/requestId');
const { apiLimiter } = require('./src/middleware/rateLimiter');
const { shutdown: shutdownAudit } = require('./src/middleware/audit');
const { metricsMiddleware, metricsHandler } = require('./src/middleware/metrics');
const { logErrorSafe } = require('./src/utils/sanitize');

let swaggerUi = null, swaggerSpec = null;
try { swaggerUi = require('swagger-ui-express'); swaggerSpec = require('./src/config/swagger'); } catch { logger.warn('Swagger no disponible — instala con: npm install swagger-jsdoc swagger-ui-express'); }

let cache = { get: () => null, set: () => {}, del: () => {}, close: () => {} };
try { cache = require('./src/config/cache'); } catch { /* Redis opcional */ }

dotenv.config({ path: path.join(__dirname, '.env') });

const REQUIRED_ENV_VARS = ['JWT_SECRET', 'DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
const missing = REQUIRED_ENV_VARS.filter(v => !process.env[v]);
if (missing.length > 0) {
  logger.error(`Faltan variables de entorno requeridas: ${missing.join(', ')}`);
  process.exit(1);
}

const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);

const isProduction = process.env.NODE_ENV === 'production';
const apiHost = process.env.API_HOST || 'localhost';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https://ui-avatars.com"],
      fontSrc: ["'self'"],
      connectSrc: isProduction
        ? ["'self'", `https://${apiHost}`, `wss://${apiHost}`]
        : ["'self'", "ws:", "http://localhost:*", "http://127.0.0.1:*"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
    },
  },
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  crossOriginEmbedderPolicy: false,
  hsts: isProduction ? {
    maxAge: 63072000,
    includeSubDomains: true,
    preload: true,
  } : false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
  : ['http://localhost:4200', 'http://localhost:4201', 'http://localhost'];

/**
 * Configuración del servidor Socket.IO para comunicación en tiempo real
 * con los clientes (turnero, recepción, módulo médico).
 */
const io = new Server(server, {
  cors: {
    origin: corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

app.use(cors({
  origin: corsOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

app.use(cookieParser());
app.use((req, res, next) => {
  req.io = io;
  next();
});
app.use(requestId);
app.use(metricsMiddleware);
app.use('/api', apiLimiter);

/**
 * HTTPS is enforced at the Nginx reverse proxy level (SSL termination).
 * Internal traffic between Nginx and this server uses HTTP.
 */
if (isProduction) {
  app.use((req, res, next) => {
    next();
  });
}

const PORT = process.env.PORT || 3001;

/**
 * Inicia el servidor: verifica la conexión a la base de datos, ejecuta
 * migraciones automáticas y pone a escuchar el puerto configurado.
 */
const startServer = async () => {
  try {
    await pool.query('SELECT NOW()');
    logger.info('Conexión a PostgreSQL exitosa');

    const { runMigrations } = require('./migrate');
    await runMigrations();

    const { limpiarEstadosPendientes } = require('./src/repositories/atencion.repository');
    await limpiarEstadosPendientes();

    await pool.query('UPDATE "Usuarios" SET sesion_token = NULL');

    server.listen(PORT, () => {
      logger.info(`Servidor backend corriendo en http://localhost:${PORT}`);
    });

  } catch (err) {
    logger.error('Error al conectar con la base de datos', { error: err.message });
    process.exit(1);
  }
};

if (require.main === module) {
  startServer();
}

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'API funcionando correctamente' });
});
app.get('/api/metrics', metricsHandler);
if (swaggerUi && swaggerSpec) {
  app.get('/api/docs.json', (req, res) => res.json(swaggerSpec));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Clínica API - Documentación',
  }));
}

const authRoutes = require('./src/routes/auth.routes');
const adminRoutes = require('./src/routes/admin.routes');
const turnosRoutes = require('./src/routes/turnos.routes');
const consultoriosRoutes = require('./src/routes/consultorios.routes');
const recepcionRoutes = require('./src/routes/recepcion.routes');
const sharedRoutes = require('./src/routes/shared.routes');
const medicoRoutes = require('./src/routes/medico.routes');
const especialidadesRoutes = require('./src/routes/especialidades.routes');
const turneroRoutes = require('./src/routes/turnero.routes');
const recuperacionRoutes = require('./src/routes/recuperacion.routes');

app.use('/api/auth', authRoutes);
app.use('/api/auth/recuperacion', recuperacionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/shared', sharedRoutes);
app.use('/api/turnos', turnosRoutes);
app.use('/api/consultorios', consultoriosRoutes);
app.use('/api/recepcion', recepcionRoutes);
app.use('/api/medico', medicoRoutes);
app.use('/api/especialidades', especialidadesRoutes);
app.use('/api/turnero', turneroRoutes);

// Endpoint de desarrollo: generar token JWT para un usuario por ID
if (!isProduction) {
  app.post('/api/dev/token/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      const result = await pool.query(
        `SELECT u.id_usuario as id, u.cedula, r.key as rol, u.id_rol,
                u.primer_nombre AS nombre, u.primer_apellido AS apellido,
                u.id_servicio as servicio_id, u.id_consultorio as consultorio_id, u.id_sede,
                u.id_especialidad, e.nombre as especialidad_nombre, u.sesion_token, u.status,
                COALESCE(
                  (SELECT json_agg(rec.key || ':' || acc.key)
                   FROM "Roles_Recursos_Acciones" rra
                   INNER JOIN "Recursos" rec ON rra.id_recurso = rec.id_recurso
                   INNER JOIN "Acciones" acc ON rra.id_accion = acc.id_accion
                   WHERE rra.id_rol = u.id_rol), '[]'::json
                ) as permisos
         FROM "Usuarios" u
         LEFT JOIN "Roles" r ON u.id_rol = r.id_rol
         LEFT JOIN "Especialidades" e ON u.id_especialidad = e.id_especialidad
         WHERE u.id_usuario = $1`, [id]
      );

      const usuario = result.rows[0];
      if (!usuario) return res.status(404).json({ mensaje: 'Usuario no encontrado' });
      if (usuario.status === false) return res.status(403).json({ mensaje: 'Usuario inactivo' });

      const permisos = Array.isArray(usuario.permisos) ? usuario.permisos : (usuario.permisos ? JSON.parse(usuario.permisos) : []);

      const payload = {
        id: usuario.id,
        id_rol: usuario.id_rol,
        cedula: usuario.cedula,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        rol: usuario.rol,
        permisos,
        servicio_id: usuario.servicio_id,
        consultorio_id: usuario.consultorio_id,
        id_sede: usuario.id_sede,
        id_especialidad: usuario.id_especialidad,
        especialidad_nombre: usuario.especialidad_nombre,
        sesion_token: usuario.sesion_token || null,
      };

      const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
      return res.json({ token, usuario: payload });
    } catch (err) {
      logger.error('Error generando token dev', { error: err.message });
      return res.status(500).json({ mensaje: 'Error interno' });
    }
  });
}

/**
 * Manejador global de errores. Sanitiza los datos sensibles antes de
 * registrar y devuelve una respuesta genérica al cliente.
 */
app.use((err, req, res, next) => {
  logErrorSafe('Error no controlado', err, { method: req.method, url: req.url });
  res.status(err.status || 500).json({ mensaje: err.status ? err.message : 'Error interno del servidor' });
});

/**
 * Middleware de autenticación para Socket.IO. Si el cliente envía un
 * token JWT válido, se asigna a socket.usuario; si no, se permite
 * la conexión como anónimo (turnero público).
 */
io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (!token) {
    socket.usuario = null;
    return next();
  }
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      socket.usuario = null;
      return next();
    }
    socket.usuario = decoded;
    next();
  });
});

io.on('connection', (socket) => {
  logger.info(`Cliente conectado: ${socket.id}${socket.usuario ? ` (${socket.usuario.rol})` : ' (anónimo)'}`);
  socket.on('disconnect', () => {
    logger.info(`Cliente desconectado: ${socket.id}`);
  });
});

/**
 * Apagado graceful: cierra conexiones de auditoría, caché, Socket.IO,
 * servidor HTTP y pool de base de datos.
 *
 * @param {string} signal - Señal de terminación recibida
 */
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} recibido, cerrando servidor...`);
  await shutdownAudit();
  await cache.close();
  io.close();
  server.close(() => {
    pool.end(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection', { error: reason?.message || reason });
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception', { error: err.message, stack: err.stack });
  process.exit(1);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    logger.warn(`Puerto ${PORT} en uso. Asegúrese de que no haya otra instancia corriendo.`);
    process.exit(1);
  } else {
    logger.error('Error al iniciar servidor', { error: err.message });
  }
});

module.exports = { app, server, io };
