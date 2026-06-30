const mockPool = {
  query: jest.fn(),
};
jest.mock('../src/config/db', () => mockPool);

const ctrl = require('../src/controllers/recepcion.controller');

describe('recepcionController', () => {
  let req, res;

  beforeEach(() => {
    req = { body: {}, params: {}, query: {}, usuario: { id_sede: 1, id: 1 } };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    jest.clearAllMocks();
  });

  describe('getResponsablesPago', () => {
    test('debe retornar lista de responsables', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id_responsable: 1, nombre: 'Particular', status: true }] });
      await ctrl.getResponsablesPago(req, res);
      expect(res.json).toHaveBeenCalledWith([{ id_responsable: 1, nombre: 'Particular', status: true }]);
    });
  });

  describe('buscarPaciente', () => {
    test('debe retornar 401 sin sede', async () => {
      req.usuario = {};
      await ctrl.buscarPaciente(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    test('debe buscar por cédula', async () => {
      req.params = { termino: '123' };
      req.query = { filtro: 'cedula' };
      mockPool.query.mockResolvedValue({ rows: [{ id_paciente: 1, cedula: '123', nombre: 'Juan' }] });
      await ctrl.buscarPaciente(req, res);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('cedula ILIKE $1'),
        expect.any(Array),
      );
      expect(res.json).toHaveBeenCalledWith([{ id_paciente: 1, cedula: '123', nombre: 'Juan' }]);
    });
  });

  describe('crearPaciente', () => {
    test('debe retornar 400 si faltan campos', async () => {
      req.body = { cedula: '', primer_nombre: '', primer_apellido: '' };
      await ctrl.crearPaciente(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('debe crear paciente exitosamente', async () => {
      req.body = { cedula: '123', primer_nombre: 'Juan', primer_apellido: 'Pérez', telefono: '555' };
      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id_paciente: 1, cedula: '123', primer_nombre: 'Juan', primer_apellido: 'Pérez', telefono: '555' }] });
      await ctrl.crearPaciente(req, res);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id_paciente: 1 }));
    });

    test('debe retornar 409 si la cédula ya existe en la sede', async () => {
      req.body = { cedula: '123', primer_nombre: 'Juan', primer_apellido: 'Pérez' };
      mockPool.query.mockResolvedValueOnce({ rows: [{ id_paciente: 1, cedula: '123' }] });
      await ctrl.crearPaciente(req, res);
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({ mensaje: 'Ya existe un paciente con esa cédula en esta sede' });
    });

    test('debe retornar 400 si la cédula ya existe (23505)', async () => {
      req.body = { cedula: '123', primer_nombre: 'Juan', primer_apellido: 'Pérez' };
      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockRejectedValueOnce({ code: '23505' });
      await ctrl.crearPaciente(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ mensaje: 'Ya existe un paciente con esa cédula' });
    });
  });

  describe('actualizarPaciente', () => {
    test('debe retornar 404 si no encuentra el paciente', async () => {
      req.params = { id: '999' };
      req.body = { primer_nombre: 'Juan' };
      mockPool.query.mockResolvedValue({ rowCount: 0, rows: [] });
      await ctrl.actualizarPaciente(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('debe actualizar paciente exitosamente', async () => {
      req.params = { id: '1' };
      req.body = { primer_nombre: 'Juan Updated', cedula: '123' };
      mockPool.query.mockResolvedValue({ rowCount: 1, rows: [{ id_paciente: 1, cedula: '123', primer_nombre: 'Juan Updated' }] });
      await ctrl.actualizarPaciente(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id_paciente: 1 }));
    });
  });

  describe('generarTurno', () => {
    test('debe retornar 400 si faltan paciente o servicio', async () => {
      req.body = {};
      await ctrl.generarTurno(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('debe generar turno exitosamente', async () => {
      req.body = { id_paciente: 1, id_servicio: 1 };
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ prefijo: 'C' }] })
        .mockResolvedValueOnce({ rows: [{ next: 5 }] })
        .mockResolvedValueOnce({ rows: [{ id_atencion: 10, numero: 'C-005', hora_llegada: new Date() }] });
      await ctrl.generarTurno(req, res);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id_atencion: 10, numero: 'C-005' }));
    });
  });
});
