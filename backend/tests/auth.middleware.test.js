const jwt = require('jsonwebtoken');

const mockPool = {
  query: jest.fn(),
};
jest.mock('../src/config/db', () => mockPool);

jest.mock('jsonwebtoken');

const authMiddleware = require('../src/middleware/auth');

describe('authMiddleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = { headers: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  test('debe retornar 401 si no hay token', async () => {
    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ mensaje: 'No token' });
    expect(next).not.toHaveBeenCalled();
  });

  test('debe retornar 401 si el token es inválido', async () => {
    req.headers.authorization = 'Bearer token-invalido';
    jwt.verify.mockImplementation(() => { throw new Error('Invalid token'); });

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ mensaje: 'Token inválido' });
    expect(next).not.toHaveBeenCalled();
  });

  test('debe llamar next() si el token es válido', async () => {
    const decoded = { id: 1, username: 'admin', rol: 'admin', sesion_token: 'token123' };
    req.headers.authorization = 'Bearer token-valido';
    jwt.verify.mockReturnValue(decoded);
    mockPool.query.mockResolvedValue({
      rows: [{ sesion_token: 'token123', status: true, rol_activo: true, id_especialidad: null, esp_activo: null }],
    });

    await authMiddleware(req, res, next);

    expect(req.usuario).toEqual(decoded);
    expect(next).toHaveBeenCalled();
  });

  test('debe usar el header de autorización correctamente', async () => {
    const decoded = { id: 2, rol: 'medico', sesion_token: 'token456' };
    req.headers.authorization = 'Bearer mi-token-seguro';
    jwt.verify.mockReturnValue(decoded);
    mockPool.query.mockResolvedValue({
      rows: [{ sesion_token: 'token456', status: true, rol_activo: true, id_especialidad: null, esp_activo: null }],
    });

    await authMiddleware(req, res, next);

    expect(jwt.verify).toHaveBeenCalledWith('mi-token-seguro', process.env.JWT_SECRET);
    expect(req.usuario).toEqual(decoded);
  });

  test('debe retornar 401 si el usuario está desactivado', async () => {
    const decoded = { id: 1, username: 'admin', rol: 'admin', sesion_token: 'token123' };
    req.headers.authorization = 'Bearer token-valido';
    jwt.verify.mockReturnValue(decoded);
    mockPool.query.mockResolvedValue({
      rows: [{ sesion_token: 'token123', status: false, rol_activo: true, id_especialidad: null, esp_activo: null }],
    });

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ mensaje: 'Sesión inválida. Tu usuario ha sido desactivado.' });
    expect(next).not.toHaveBeenCalled();
  });

  test('debe retornar 401 si el rol está desactivado', async () => {
    const decoded = { id: 1, username: 'admin', rol: 'admin', sesion_token: 'token123' };
    req.headers.authorization = 'Bearer token-valido';
    jwt.verify.mockReturnValue(decoded);
    mockPool.query.mockResolvedValue({
      rows: [{ sesion_token: 'token123', status: true, rol_activo: false, id_especialidad: null, esp_activo: null }],
    });

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ mensaje: 'Sesión inválida. Tu rol ha sido desactivado.' });
    expect(next).not.toHaveBeenCalled();
  });

  test('debe retornar 401 si la especialidad del médico está desactivada', async () => {
    const decoded = { id: 1, username: 'doc', rol: 'medico', sesion_token: 'token123' };
    req.headers.authorization = 'Bearer token-valido';
    jwt.verify.mockReturnValue(decoded);
    mockPool.query.mockResolvedValue({
      rows: [{ sesion_token: 'token123', status: true, rol_activo: true, id_especialidad: 5, esp_activo: false }],
    });

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ mensaje: 'Sesión inválida. Tu especialidad ha sido desactivada.' });
    expect(next).not.toHaveBeenCalled();
  });

  test('debe retornar 401 si el token de sesión no coincide (sesión concurrente)', async () => {
    const decoded = { id: 1, username: 'admin', rol: 'admin', sesion_token: 'token-antiguo' };
    req.headers.authorization = 'Bearer token-valido';
    jwt.verify.mockReturnValue(decoded);
    mockPool.query.mockResolvedValue({
      rows: [{ sesion_token: 'token-nuevo', status: true, rol_activo: true, id_especialidad: null, esp_activo: null }],
    });

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ mensaje: 'Sesión inválida. Otro usuario ha iniciado sesión con tus credenciales.' });
    expect(next).not.toHaveBeenCalled();
  });
});
