const mockPool = {
  query: jest.fn(),
};
const mockBcrypt = {
  hash: jest.fn(),
  compare: jest.fn(),
};
const mockCrypto = {
  randomInt: jest.fn(),
};
const mockEnviarCorreoOTP = jest.fn();

jest.mock('../src/config/db', () => mockPool);
jest.mock('bcryptjs', () => mockBcrypt);
jest.mock('crypto', () => mockCrypto);
jest.mock('../src/config/email', () => ({
  enviarCorreoOTP: mockEnviarCorreoOTP,
}));

const recuperacionController = require('../src/controllers/recuperacion.controller');

describe('recuperacionController', () => {
  let req, res;

  beforeEach(() => {
    req = { body: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    jest.clearAllMocks();
    mockPool.query.mockReset();
    mockBcrypt.hash.mockReset();
    mockBcrypt.compare.mockReset();
    mockCrypto.randomInt.mockReset();
    mockEnviarCorreoOTP.mockReset();
  });

  describe('solicitar', () => {
    test('debe retornar 400 si faltan email o cédula', async () => {
      req.body = { email: '', cedula: '' };
      await recuperacionController.solicitar(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('debe retornar 404 si email o cédula incorrectos', async () => {
      req.body = { email: 'test@test.com', cedula: '123' };
      mockPool.query.mockResolvedValue({ rows: [] });
      await recuperacionController.solicitar(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ mensaje: 'Correo o cédula incorrectos' });
    });

    test('debe enviar código exitosamente', async () => {
      req.body = { email: 'test@test.com', cedula: '123' };
      const usuarioMock = { id_usuario: 1, email: 'test@test.com', cedula: '123' };
      mockPool.query.mockResolvedValue({ rows: [usuarioMock] });
      mockCrypto.randomInt.mockReturnValue(123456);
      mockEnviarCorreoOTP.mockResolvedValue();
      
      await recuperacionController.solicitar(req, res);
      
      expect(mockPool.query).toHaveBeenCalledWith(
        'UPDATE "Recuperacion_Clave" SET usado = true WHERE id_usuario = $1 AND usado = false',
        [1]
      );
      expect(mockPool.query).toHaveBeenCalledWith(
        'INSERT INTO "Recuperacion_Clave" (id_usuario, codigo, expiracion) VALUES ($1, $2, NOW() + INTERVAL \'3 minutes\')',
        [1, '123456']
      );
      expect(mockEnviarCorreoOTP).toHaveBeenCalledWith('test@test.com', '123456');
      expect(res.json).toHaveBeenCalledWith({ mensaje: 'Código enviado al correo registrado', expiracion: 180 });
    });

    test('debe retornar 500 si falla el envío de email', async () => {
      req.body = { email: 'test@test.com', cedula: '123' };
      const usuarioMock = { id_usuario: 1, email: 'test@test.com', cedula: '123' };
      mockPool.query.mockResolvedValue({ rows: [usuarioMock] });
      mockCrypto.randomInt.mockReturnValue(123456);
      mockEnviarCorreoOTP.mockRejectedValue(new Error('Email error'));
      
      await recuperacionController.solicitar(req, res);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ mensaje: 'Error al enviar el correo. Verifica la configuración de email.' });
    });

    test('debe retornar 500 si hay error interno', async () => {
      req.body = { email: 'test@test.com', cedula: '123' };
      mockPool.query.mockRejectedValue(new Error('DB error'));
      
      await recuperacionController.solicitar(req, res);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ mensaje: 'Error interno' });
    });
  });

  describe('verificar', () => {
    test('debe retornar 400 si faltan email, cédula o código', async () => {
      req.body = { email: '', cedula: '', codigo: '' };
      await recuperacionController.verificar(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('debe retornar 400 si no hay código pendiente', async () => {
      req.body = { email: 'test@test.com', cedula: '123', codigo: '123456' };
      mockPool.query.mockResolvedValue({ rows: [] });
      await recuperacionController.verificar(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ mensaje: 'No hay código pendiente. Solicita uno nuevo.' });
    });

    test('debe retornar 400 si el código expiró', async () => {
      req.body = { email: 'test@test.com', cedula: '123', codigo: '123456' };
      const registroMock = { 
        id_recuperacion: 1, 
        codigo: '123456', 
        expiracion: new Date(Date.now() - 10000) // Fecha pasada (expirado)
      };
      mockPool.query.mockResolvedValue({ rows: [registroMock] });
      
      await recuperacionController.verificar(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ mensaje: 'El código ha expirado. Solicita uno nuevo.' });
    });

    test('debe retornar 400 si el código es incorrecto', async () => {
      req.body = { email: 'test@test.com', cedula: '123', codigo: '123456' };
      const registroMock = { 
        id_recuperacion: 1, 
        codigo: '654321', // Código diferente
        expiracion: new Date(Date.now() + 100000) // Fecha futura
      };
      mockPool.query.mockResolvedValue({ rows: [registroMock] });
      
      await recuperacionController.verificar(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ mensaje: 'Código incorrecto' });
    });

    test('debe retornar 200 si el código es correcto', async () => {
      req.body = { email: 'test@test.com', cedula: '123', codigo: '123456' };
      const registroMock = { 
        id_recuperacion: 1, 
        codigo: '123456',
        expiracion: new Date(Date.now() + 100000) // Fecha futura
      };
      mockPool.query.mockResolvedValue({ rows: [registroMock] });
      
      await recuperacionController.verificar(req, res);
      
      expect(res.json).toHaveBeenCalledWith({ mensaje: 'Código verificado correctamente' });
    });

    test('debe retornar 500 si hay error interno', async () => {
      req.body = { email: 'test@test.com', cedula: '123', codigo: '123456' };
      mockPool.query.mockRejectedValue(new Error('DB error'));
      
      await recuperacionController.verificar(req, res);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ mensaje: 'Error interno' });
    });
  });

  describe('restablecer', () => {
    test('debe retornar 400 si faltan campos requeridos', async () => {
      req.body = { email: '', cedula: '', codigo: '', newPassword: '' };
      await recuperacionController.restablecer(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('debe retornar 400 si la nueva contraseña es muy corta', async () => {
      req.body = { email: 'test@test.com', cedula: '123', codigo: '123456', newPassword: '123' };
      await recuperacionController.restablecer(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ mensaje: 'La contraseña debe tener al menos 4 caracteres' });
    });

    test('debe retornar 400 si no hay código pendiente', async () => {
      req.body = { email: 'test@test.com', cedula: '123', codigo: '123456', newPassword: 'NuevaPass123' };
      mockPool.query.mockResolvedValue({ rows: [] });
      await recuperacionController.restablecer(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ mensaje: 'No hay código pendiente. Solicita uno nuevo.' });
    });

    test('debe retornar 400 si el código expiró', async () => {
      req.body = { email: 'test@test.com', cedula: '123', codigo: '123456', newPassword: 'NuevaPass123' };
      const registroMock = { 
        id_recuperacion: 1, 
        codigo: '123456', 
        expiracion: new Date(Date.now() - 10000), // Expirado
      };
      mockPool.query.mockResolvedValue({ rows: [registroMock] });
      
      await recuperacionController.restablecer(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ mensaje: 'El código ha expirado. Solicita uno nuevo.' });
    });

    test('debe retornar 400 si el código es incorrecto', async () => {
      req.body = { email: 'test@test.com', cedula: '123', codigo: '123456', newPassword: 'NuevaPass123' };
      const registroMock = { 
        id_recuperacion: 1, 
        codigo: '654321', // Incorrecto
        expiracion: new Date(Date.now() + 100000), // Válido
      };
      mockPool.query.mockResolvedValue({ rows: [registroMock] });
      
      await recuperacionController.restablecer(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ mensaje: 'Código incorrecto' });
    });

    test('debe restablecer la contraseña exitosamente', async () => {
      req.body = { email: 'test@test.com', cedula: '123', codigo: '123456', newPassword: 'NuevaPass123' };
      const registroMock = { 
        id_recuperacion: 1, 
        codigo: '123456',
        expiracion: new Date(Date.now() + 100000), // Válido
      };
      mockPool.query.mockResolvedValue({ rows: [registroMock] });
      mockBcrypt.hash.mockResolvedValue('hashed_password_123');
      
      await recuperacionController.restablecer(req, res);
      
      expect(mockBcrypt.hash).toHaveBeenCalledWith('NuevaPass123', 10);
      expect(mockPool.query).toHaveBeenCalledWith(
        'UPDATE "Usuarios" SET password_hash = $1 WHERE cedula = $2',
        ['hashed_password_123', '123']
      );
      expect(mockPool.query).toHaveBeenCalledWith(
        'UPDATE "Recuperacion_Clave" SET usado = true WHERE id_recuperacion = $1',
        [1]
      );
      expect(res.json).toHaveBeenCalledWith({ mensaje: 'Contraseña actualizada exitosamente' });
    });

    test('debe retornar 500 si hay error interno', async () => {
      req.body = { email: 'test@test.com', cedula: '123', codigo: '123456', newPassword: 'NuevaPass123' };
      mockPool.query.mockRejectedValue(new Error('DB error'));
      
      await recuperacionController.restablecer(req, res);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ mensaje: 'Error interno' });
    });
  });
});
