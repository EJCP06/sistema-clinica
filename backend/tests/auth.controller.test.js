const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

jest.mock('bcryptjs');
jest.mock('jsonwebtoken');

const mockPool = {
  query: jest.fn(),
};
jest.mock('../src/config/db', () => mockPool);

const authController = require('../src/controllers/auth.controller');

describe('authController.login', () => {
  let req, res;

  beforeEach(() => {
    req = { body: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    jest.clearAllMocks();
  });

  test('debe retornar 400 si faltan credenciales', async () => {
    req.body = { username: '', password: '' };

    await authController.login(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ mensaje: 'Por favor proporcione cédula y password' });
  });

  test('debe retornar 401 si el usuario no existe', async () => {
    req.body = { username: '111111', password: '123456' };
    mockPool.query.mockResolvedValue({ rows: [] });

    await authController.login(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ mensaje: 'Usuario inválido' });
  });

  test('debe retornar 401 si la contraseña es inválida', async () => {
    req.body = { username: '00000000', password: 'wrongpass' };
    mockPool.query.mockResolvedValue({
      rows: [{
        id: 1, cedula: '00000000', password_hash: '$2a$10$hash',
        rol: 'admin', nombre: 'Admin', apellido: 'Sistema',
      }],
    });
    bcrypt.compare.mockResolvedValue(false);

    await authController.login(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ mensaje: 'Contraseña inválida' });
  });

  test('debe retornar token si las credenciales son correctas', async () => {
    const mockUsuario = {
      id: 1, cedula: '00000000', password_hash: '$2a$10$hash',
      rol: 'admin', nombre: 'Admin', apellido: 'Sistema',
      servicio_id: null, consultorio_id: null, id_sede: 1,
      id_especialidad: null, especialidad_nombre: null,
    };
    req.body = { username: '00000000', password: '123456' };
    mockPool.query.mockResolvedValue({ rows: [mockUsuario] });
    bcrypt.compare.mockResolvedValue(true);
    jwt.sign.mockReturnValue('token-falso');

    await authController.login(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      mensaje: 'Login exitoso',
      token: 'token-falso',
      usuario: expect.objectContaining({
        id: 1, cedula: '00000000', rol: 'admin', nombre: 'Admin',
      }),
    });
  });

  test('debe retornar 500 si hay un error de base de datos', async () => {
    req.body = { username: '00000000', password: '123456' };
    mockPool.query.mockRejectedValue(new Error('DB connection failed'));

    await authController.login(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ mensaje: 'Error interno' });
  });
});
