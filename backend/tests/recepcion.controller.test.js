const mockPool = {
  query: jest.fn(),
  connect: jest.fn(),
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

    test('debe retornar 400 si la especialidad está inactiva', async () => {
      req.body = { id_paciente: 1, id_servicio: 1, id_especialidad: 99 };
      mockPool.query.mockResolvedValueOnce({ rows: [{ activo: false }] });
      await ctrl.generarTurno(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ mensaje: 'La especialidad seleccionada está inactiva' });
    });

    test('debe generar turno exitosamente', async () => {
      req.body = { id_paciente: 1, id_servicio: 1 };
      const client = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ ultimo: 5 }] })
          .mockResolvedValueOnce({ rows: [{ id_atencion: 10, numero: 'C-005', hora_llegada: new Date() }] })
          .mockResolvedValueOnce({ rows: [] }),
        release: jest.fn(),
      };
      mockPool.connect.mockResolvedValue(client);
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ prefijo: 'C' }] })
        .mockResolvedValue({ rows: [] });
      await ctrl.generarTurno(req, res);
      expect(mockPool.connect).toHaveBeenCalled();
      expect(client.query).toHaveBeenCalledWith('BEGIN');
      expect(client.query).toHaveBeenCalledWith('COMMIT');
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id_atencion: 10, numero: 'C-005' }));
    });
  });

  describe('llamarAPS', () => {
    test('debe retornar 401 sin sede', async () => {
      req.usuario = {};
      await ctrl.llamarAPS(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    test('debe retornar 404 si la atención no existe', async () => {
      req.params = { id: '999' };
      mockPool.query.mockResolvedValue({ rows: [] });
      await ctrl.llamarAPS(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ mensaje: 'Atención no encontrada' });
    });

    test('debe retornar 400 si el paciente no está en estado Registrado', async () => {
      req.params = { id: '1' };
      mockPool.query.mockResolvedValue({ rows: [{ id_atencion: 1, id_estado_actual: 4, numero: 'C-01', nombre: 'Juan', apellido: 'Pérez' }] });
      await ctrl.llamarAPS(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ mensaje: 'El paciente debe estar en estado Registrado para ser llamado' });
    });

    test('debe emitir nuevo-llamado sin cambiar el estado', async () => {
      req.params = { id: '1' };
      const emit = jest.fn();
      req.io = { emit };
      mockPool.query.mockResolvedValue({ rows: [{ id_atencion: 1, id_estado_actual: 1, numero: 'C-01', nombre: 'Juan', apellido: 'Pérez' }] });
      await ctrl.llamarAPS(req, res);
      expect(emit).toHaveBeenCalledWith('nuevo-llamado', expect.objectContaining({
        tipo: 'llamado',
        id_atencion: 1,
        turno: 'C-01',
        consultorio: 'APS',
        paciente: 'Juan',
        apellido: 'Pérez',
        id_sede: 1,
      }));
      expect(mockPool.query).toHaveBeenCalledTimes(1);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ mensaje: 'Paciente llamado correctamente' }));
    });
  });

  describe('llamarClaveAPS', () => {
    test('debe retornar 401 sin sede', async () => {
      req.usuario = {};
      await ctrl.llamarClaveAPS(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    test('debe retornar 404 si la atención no existe', async () => {
      req.params = { id: '999' };
      mockPool.query.mockResolvedValue({ rows: [] });
      await ctrl.llamarClaveAPS(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ mensaje: 'Atención no encontrada' });
    });

    test('debe retornar 400 si el paciente no está en estado Espera de Clave', async () => {
      req.params = { id: '1' };
      mockPool.query.mockResolvedValue({ rows: [{ id_atencion: 1, id_estado_actual: 1, numero: 'C-01', nombre: 'Juan', apellido: 'Pérez' }] });
      await ctrl.llamarClaveAPS(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ mensaje: 'El paciente debe estar en estado Espera de Clave para ser llamado' });
    });

    test('debe emitir nuevo-llamado sin cambiar el estado (clave aprobada)', async () => {
      req.params = { id: '1' };
      const emit = jest.fn();
      req.io = { emit };
      mockPool.query.mockResolvedValue({ rows: [{ id_atencion: 1, id_estado_actual: 8, numero: 'C-01', nombre: 'Juan', apellido: 'Pérez' }] });
      await ctrl.llamarClaveAPS(req, res);
      expect(emit).toHaveBeenCalledWith('nuevo-llamado', expect.objectContaining({
        tipo: 'llamado',
        id_atencion: 1,
        turno: 'C-01',
        consultorio: 'APS',
        paciente: 'Juan',
        apellido: 'Pérez',
        id_sede: 1,
        forzar: true,
      }));
      expect(mockPool.query).toHaveBeenCalledTimes(1);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ mensaje: 'Paciente llamado correctamente' }));
    });
  });

  describe('llamarLaboratorio / llamarImagenes', () => {
    test('deben retornar 401 sin sede', async () => {
      req.usuario = {};
      await ctrl.llamarLaboratorio(req, res);
      await ctrl.llamarImagenes(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    test('deben retornar 400 si el paciente no está en estado Registrado', async () => {
      req.params = { id: '1' };
      mockPool.query.mockResolvedValue({ rows: [{ id_atencion: 1, id_estado_actual: 4, numero: 'L-01', nombre: 'Ana', apellido: 'Gómez' }] });
      await ctrl.llamarLaboratorio(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ mensaje: 'El paciente debe estar en estado Registrado para ser llamado' });
    });

    test('laboratorio debe emitir nuevo-llamado con consultorio LABORATORIO', async () => {
      req.params = { id: '1' };
      const emit = jest.fn();
      req.io = { emit };
      mockPool.query.mockResolvedValue({ rows: [{ id_atencion: 1, id_estado_actual: 1, numero: 'L-01', nombre: 'Ana', apellido: 'Gómez' }] });
      await ctrl.llamarLaboratorio(req, res);
      expect(emit).toHaveBeenCalledWith('nuevo-llamado', expect.objectContaining({
        tipo: 'llamado',
        id_atencion: 1,
        turno: 'L-01',
        consultorio: 'LABORATORIO',
        paciente: 'Ana',
        apellido: 'Gómez',
        id_sede: 1,
        forzar: true,
      }));
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ mensaje: 'Paciente llamado correctamente' }));
    });

    test('imagenes debe emitir nuevo-llamado con consultorio IMAGENES', async () => {
      req.params = { id: '1' };
      const emit = jest.fn();
      req.io = { emit };
      mockPool.query.mockResolvedValue({ rows: [{ id_atencion: 1, id_estado_actual: 1, numero: 'I-01', nombre: 'Luis', apellido: 'Mora' }] });
      await ctrl.llamarImagenes(req, res);
      expect(emit).toHaveBeenCalledWith('nuevo-llamado', expect.objectContaining({
        tipo: 'llamado',
        id_atencion: 1,
        turno: 'I-01',
        consultorio: 'IMAGENES',
        paciente: 'Luis',
        apellido: 'Mora',
        id_sede: 1,
        forzar: true,
      }));
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ mensaje: 'Paciente llamado correctamente' }));
    });
  });

  describe('actualizarEstadoAtencion', () => {
    test('debe retornar 404 si la atención no existe', async () => {
      req.params = { id: '999' };
      req.body = { id_estado_nuevo: 4 };
      mockPool.query.mockResolvedValue({ rows: [] });
      await ctrl.actualizarEstadoAtencion(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ mensaje: 'Atención no encontrada' });
    });

    test('debe ser idempotente si la atención ya está en ese estado (sin duplicar historial)', async () => {
      req.params = { id: '1' };
      req.body = { id_estado_nuevo: 3 };
      req.io = { emit: jest.fn() };
      mockPool.query.mockResolvedValue({ rows: [{ id_estado_actual: 3 }] });
      await ctrl.actualizarEstadoAtencion(req, res);
      expect(res.json).toHaveBeenCalledWith({ mensaje: 'Estado actualizado', id_estado_actual: 3 });
      expect(mockPool.query).toHaveBeenCalledTimes(1); // solo la lectura del estado
      expect(req.io.emit).not.toHaveBeenCalled();
    });

    test('debe actualizar el estado, emitir evento e insertar historial cuando cambia', async () => {
      req.params = { id: '1' };
      req.body = { id_estado_nuevo: 4 };
      req.io = { emit: jest.fn() };
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ id_estado_actual: 3 }] })              // getAtencionEstado
        .mockResolvedValueOnce({ rows: [{ id_atencion: 1, id_estado_actual: 4 }] }) // UPDATE con guard
        .mockResolvedValueOnce({ rows: [] });                                     // INSERT historial
      await ctrl.actualizarEstadoAtencion(req, res);
      expect(req.io.emit).toHaveBeenCalledWith('estado-actualizado', expect.objectContaining({ id_estado_nuevo: 4 }));
      expect(res.json).toHaveBeenCalledWith({ mensaje: 'Estado actualizado', id_estado_actual: 4 });
      expect(mockPool.query).toHaveBeenCalledTimes(3);
    });
  });

  describe('marcarAusente', () => {
    test('debe retirar, emitir e insertar historial cuando el estado cambia', async () => {
      req.params = { id: '1' };
      req.io = { emit: jest.fn() };
      const client = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] })                                 // BEGIN
          .mockResolvedValueOnce({ rows: [{ id_consultorio: null }] })         // UPDATE -> 9
          .mockResolvedValueOnce({ rows: [] }),                                // COMMIT
        release: jest.fn(),
      };
      mockPool.connect.mockResolvedValue(client);
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ id_estado_actual: 2 }] })            // getAtencionEstado
        .mockResolvedValueOnce({ rows: [{ id_atencion: 1, numero: 'C-01' }] }) // getAdmisionById (emit)
        .mockResolvedValueOnce({ rows: [] });                                  // INSERT historial 9
      await ctrl.marcarAusente(req, res);
      expect(res.json).toHaveBeenCalledWith({ mensaje: 'Paciente retirado correctamente' });
      expect(req.io.emit).toHaveBeenCalled();
      expect(mockPool.query).toHaveBeenCalledTimes(3);
    });

    test('no debe duplicar historial ni emitir si ya estaba retirado', async () => {
      req.params = { id: '1' };
      req.io = { emit: jest.fn() };
      const client = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] })   // BEGIN
          .mockResolvedValueOnce({ rows: [] })   // UPDATE sin match (ya retirado)
          .mockResolvedValueOnce({ rows: [] }),  // COMMIT
        release: jest.fn(),
      };
      mockPool.connect.mockResolvedValue(client);
      mockPool.query.mockResolvedValueOnce({ rows: [{ id_estado_actual: 2 }] }); // getAtencionEstado
      await ctrl.marcarAusente(req, res);
      expect(res.json).toHaveBeenCalledWith({ mensaje: 'Paciente retirado correctamente' });
      expect(req.io.emit).not.toHaveBeenCalled();
      expect(mockPool.query).toHaveBeenCalledTimes(1); // solo la lectura del estado
    });
  });
});
