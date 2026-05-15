const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const http = require('http');
const { Server } = require('socket.io');
const dotenv = require('dotenv');
const pool = require('./src/config/db');

// Configuración de variables de entorno
const path = require('path');
dotenv.config({ path: path.join(__dirname, '.env') });

// Inicialización de la aplicación
const app = express();
const server = http.createServer(app);

// Seguridad HTTP headers
app.use(helmet());

// Configuración de Socket.io
const io = new Server(server, {
  cors: {
    origin: '*', // En producción debería restringirse al dominio del frontend
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
});

// Middlewares
app.use(cors({
  origin: ['http://localhost:4200', 'http://localhost:4201'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json());

// Hacer io accesible desde los controladores u otras rutas si es necesario
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Prueba de conexión a la Base de Datos
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Error al conectar con la base de datos:', err);
  } else {
    console.log('✅ Conexión a PostgreSQL exitosa, hora del servidor:', res.rows[0].now);
  }
});

// Rutas base
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'API funcionando correctamente' });
});

// Importar y usar las demás rutas
const authRoutes = require('./src/routes/auth.routes');
const adminRoutes = require('./src/routes/admin.routes');
const turnosRoutes = require('./src/routes/turnos.routes');
const consultoriosRoutes = require('./src/routes/consultorios.routes');
const recepcionRoutes = require('./src/routes/recepcion.routes');
const medicoRoutes = require('./src/routes/medico.routes'); // Nueva ruta

// Rutas API
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/turnos', turnosRoutes);
app.use('/api/consultorios', consultoriosRoutes);
app.use('/api/recepcion', recepcionRoutes);
app.use('/api/medico', medicoRoutes); // Nueva ruta registrada

// Manejo global de errores
app.use((err, req, res, next) => {
  console.error('❌ Error no controlado:', err);
  res.status(500).json({ mensaje: 'Error interno del servidor' });
});

// Eventos básicos de Socket.io
io.on('connection', (socket) => {
  console.log(`🔌 Nuevo cliente conectado: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`🔴 Cliente desconectado: ${socket.id}`);
  });
});

// Iniciar el servidor
const PORT = process.env.PORT || 3000;
if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`🚀 Servidor backend corriendo en http://localhost:${PORT}`);
  });
}

module.exports = { app, server, io };
