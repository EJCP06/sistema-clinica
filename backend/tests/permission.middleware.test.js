const { permissionMiddleware } = require('../src/middleware/permission');

describe('permissionMiddleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = { usuario: { cedula: '12345', permisos: [] } };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  test('debe permitir acceso si el usuario tiene permiso legacy mapeado (ej: admision -> admision:crear)', () => {
    req.usuario.permisos = ['admision']; // 'admision' maps to 'admision:*'
    
    // El endpoint requiere 'admision:crear'
    const middleware = permissionMiddleware('admision:crear');

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  test('debe denegar acceso si el usuario no tiene permiso', () => {
    req.usuario.permisos = ['laboratorio:*'];
    
    const middleware = permissionMiddleware('admision:crear');

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
