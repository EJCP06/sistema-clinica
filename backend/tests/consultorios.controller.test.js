const mockClient = {
  query: jest.fn(),
  release: jest.fn(),
};

const mockPool = {
  query: jest.fn(),
  connect: jest.fn().mockResolvedValue(mockClient),
};
jest.mock('../src/config/db', () => mockPool);

const ctrl = require('../src/controllers/consultorios.controller');

describe('consultoriosController', () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: {},
      params: {},
      usuario: {
        id_sede: 1,
        consultorio_id: 1,
        servicio_id: 1,
        rol: 'medico',
        id_especialidad: null,
      },
      io: { emit: jest.fn() },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    jest.clearAllMocks();
    mockClient.query.mockReset();
    mockClient.release.mockReset();
    mockPool.query.mockReset();
  });

  describe('obtenerMiEstado', () => {
    test('debe retornar 401 sin usuario', async () => {
      req.usuario = null;
      await ctrl.obtenerMiEstado(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    test('debe retornar estado de consultorio para rol médico', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ estado: 'LIBRE', nombre: 'Consultorio 1', servicio_nombre: 'Medicina General', turno_id: null }],
      });
      await ctrl.obtenerMiEstado(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ estado: 'LIBRE' }));
    });
  });

  describe('llamarSiguiente', () => {
    test('debe retornar 400 si el consultorio no está libre', async () => {
      mockClient.query
        .mockResolvedValueOnce() // BEGIN
        .mockResolvedValueOnce({ rows: [{ estado: 'OCUPADO', servicio_id: 1, nombre: 'C1' }] }) // consultorio check
        .mockResolvedValueOnce(); // ROLLBACK
      await ctrl.llamarSiguiente(req, res);
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ mensaje: 'El consultorio debe estar LIBRE para llamar' });
    });

    test('debe llamar al siguiente paciente exitosamente', async () => {
      const turnoMock = {
        id: 1,
        numero: 'C-001',
        nombre_paciente: 'Juan',
        apellido_paciente: 'Pérez',
        documento_paciente: '123',
        telefono_paciente: '555',
        hora_llegada: new Date(),
      };

      mockClient.query
        .mockResolvedValueOnce() // BEGIN
        .mockResolvedValueOnce({ rows: [{ estado: 'LIBRE', servicio_id: 1, nombre: 'C1' }] }) // FOR UPDATE
        .mockResolvedValueOnce({ rows: [turnoMock] }) // SELECT paciente
        .mockResolvedValueOnce() // UPDATE Atencion
        .mockResolvedValueOnce() // INSERT Historial
        .mockResolvedValueOnce() // UPDATE Consultorios
        .mockResolvedValueOnce(); // COMMIT
      await ctrl.llamarSiguiente(req, res);
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        mensaje: 'Paciente llamado exitosamente',
      }));
      expect(req.io.emit).toHaveBeenCalledWith('nuevo-llamado', expect.objectContaining({
        tipo: 'llamado',
        id_atencion: 1,
        turno: 'C-001',
        consultorio: 'C1',
        paciente: 'Juan',
        apellido: 'Pérez',
        id_sede: 1,
        inicio_inmediato: true,
      }));
    });
  });

  describe('iniciarAtencion', () => {
    test('debe retornar 404 si no hay paciente llamado', async () => {
      mockClient.query
        .mockResolvedValueOnce() // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // SELECT atencion
        .mockResolvedValueOnce(); // ROLLBACK
      await ctrl.iniciarAtencion(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('debe iniciar atención exitosamente', async () => {
      mockClient.query
        .mockResolvedValueOnce() // BEGIN
        .mockResolvedValueOnce({ rows: [{ id_atencion: 1 }] }) // SELECT atencion
        .mockResolvedValueOnce() // UPDATE estado
        .mockResolvedValueOnce() // INSERT Historial
        .mockResolvedValueOnce(); // COMMIT
      await ctrl.iniciarAtencion(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ mensaje: 'Atención iniciada correctamente' }));
    });
  });

  describe('finalizarAtencion', () => {
    test('debe finalizar atención exitosamente', async () => {
      mockClient.query
        .mockResolvedValueOnce() // BEGIN
        .mockResolvedValueOnce({ rows: [{ id_atencion: 1 }] }) // UPDATE + RETURNING
        .mockResolvedValueOnce() // INSERT Historial
        .mockResolvedValueOnce() // UPDATE Consultorios
        .mockResolvedValueOnce(); // COMMIT
      await ctrl.finalizarAtencion(req, res);
      expect(res.json).toHaveBeenCalledWith({ mensaje: 'Atención finalizada' });
    });
  });
});
