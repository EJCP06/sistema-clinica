const adminController = require('../src/controllers/admin.controller');
const bcrypt = require('bcryptjs');
const usuarioRepo = require('../src/repositories/usuario.repository');

jest.mock('bcryptjs');
jest.mock('../src/repositories/usuario.repository');
jest.mock('../src/config/logger', () => ({
  error: jest.fn()
}));

describe('adminController.crearPersonal', () => {
  let req, res;
  beforeEach(() => {
    req = {
      body: {
        cedula: '12345678',
        primer_nombre: 'Juan',
        rol: 'medico',
        password: 'password123'
      },
      usuario: { id_sede: 1 }
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    bcrypt.hash.mockResolvedValue('hashed_password');
    usuarioRepo.findByCedulaSede.mockResolvedValue(null);
    usuarioRepo.crearPersonal.mockResolvedValue({ id_usuario: 1 });
  });

  test('debe hash la contraseña si se proporciona', async () => {
    await adminController.crearPersonal(req, res);
    expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
    expect(usuarioRepo.crearPersonal).toHaveBeenCalledWith(expect.objectContaining({
      password_hash: 'hashed_password'
    }));
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('debe usar una contraseña aleatoria si no se proporciona', async () => {
    delete req.body.password;
    await adminController.crearPersonal(req, res);
    expect(bcrypt.hash).toHaveBeenCalled();
    expect(usuarioRepo.crearPersonal).toHaveBeenCalledWith(expect.objectContaining({
      password_hash: 'hashed_password'
    }));
    expect(res.status).toHaveBeenCalledWith(201);
  });
});
