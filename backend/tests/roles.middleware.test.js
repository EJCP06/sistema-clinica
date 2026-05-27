const roleMiddleware = require('../src/middleware/roles');

describe('roleMiddleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = { usuario: null };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  test('debe retornar 401 si no hay usuario en req', () => {
    const middleware = roleMiddleware('admin');

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ mensaje: 'No hay usuario autenticado' });
    expect(next).not.toHaveBeenCalled();
  });

  test('debe retornar 403 si el rol no está permitido', () => {
    req.usuario = { rol: 'recepcionista' };
    const middleware = roleMiddleware('admin');

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ mensaje: 'No tienes permisos para realizar esta acción' });
    expect(next).not.toHaveBeenCalled();
  });

  test('debe llamar next() si el rol está permitido', () => {
    req.usuario = { rol: 'admin' };
    const middleware = roleMiddleware('admin');

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  test('debe aceptar múltiples roles como argumentos separados', () => {
    req.usuario = { rol: 'medico' };
    const middleware = roleMiddleware('admin', 'medico', 'recepcionista');

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  test('debe denegar si el rol no está en la lista de permitidos', () => {
    req.usuario = { rol: 'recepcionista' };
    const middleware = roleMiddleware('admin', 'medico');

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });
});
