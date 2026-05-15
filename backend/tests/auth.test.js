const request = require('supertest');
const { app, server } = require('../index'); // Adjust path to point to index.js
const pool = require('../src/config/db'); // Adjust path to DB config

describe('Pruebas de Autenticación (Integration Test)', () => {

  // Limpiar la base de datos de prueba después de todas las pruebas si es necesario
  afterAll(async () => {
    // Cerramos el pool de DB y el servidor para que el test termine correctamente
    await pool.end();
    server.close();
  });

  describe('POST /api/auth/login', () => {
    
    it('debería retornar 404 si el usuario no existe', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'usuario_falso_123',
          password: 'password123'
        });
      
      expect(response.status).toBe(401);
      expect(response.body.mensaje).toBe('Credenciales inválidas');
    });

    it('debería retornar 400 si faltan credenciales', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'solo_username'
          // Falta password
        });
      
      expect(response.status).toBe(400);
      expect(response.body.errores).toBeDefined(); // express-validator returns errors array
    });

  });
});
