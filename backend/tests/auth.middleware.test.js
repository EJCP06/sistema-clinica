const jwt = require('jsonwebtoken');

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

  test('debe retornar 401 si no hay token', () => {
    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ mensaje: 'No token' });
    expect(next).not.toHaveBeenCalled();
  });

  test('debe retornar 401 si el token es inválido', () => {
    req.headers.authorization = 'Bearer token-invalido';
    jwt.verify.mockImplementation(() => { throw new Error('Invalid token'); });

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ mensaje: 'Token inválido' });
    expect(next).not.toHaveBeenCalled();
  });

  test('debe llamar next() si el token es válido', () => {
    const decoded = { id: 1, username: 'admin', rol: 'admin' };
    req.headers.authorization = 'Bearer token-valido';
    jwt.verify.mockReturnValue(decoded);

    authMiddleware(req, res, next);

    expect(req.usuario).toEqual(decoded);
    expect(next).toHaveBeenCalled();
  });

  test('debe usar el header de autorización correctamente', () => {
    const decoded = { id: 2, rol: 'medico' };
    req.headers.authorization = 'Bearer mi-token-seguro';
    jwt.verify.mockReturnValue(decoded);

    authMiddleware(req, res, next);

    expect(jwt.verify).toHaveBeenCalledWith('mi-token-seguro', process.env.JWT_SECRET);
    expect(req.usuario).toEqual(decoded);
  });
});
