import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Consultorio, Especialidad, Turno, Paciente } from '@core/models/turnos.model';

@Injectable({ providedIn: 'root' })
export class QueueService {
  // -------------------------
  // Mock initial data
  // -------------------------
  private especialidades: Especialidad[] = [
    { id: 'ESP-1', nombre: 'Pediatría', ubicacion: 'Piso 1', prefijo: 'PED' },
    { id: 'ESP-2', nombre: 'Ginecología', ubicacion: 'Piso 2', prefijo: 'GIN' },
    { id: 'ESP-3', nombre: 'Laboratorio', ubicacion: 'Piso 1', prefijo: 'LAB' },
    { id: 'ESP-4', nombre: 'Traumatología', ubicacion: 'Piso 2', prefijo: 'TRA' },
  ];

  private consultorios: Consultorio[] = [
    { id: 'CON-1', nombre: 'Consultorio 101', especialidadId: 'ESP-1', estado: 'LIBRE', medicoAsignado: 'Dra. Gómez' },
    { id: 'CON-2', nombre: 'Consultorio 201', especialidadId: 'ESP-2', estado: 'LIBRE', medicoAsignado: 'Dr. Pérez' },
    { id: 'CON-3', nombre: 'Box 1', especialidadId: 'ESP-3', estado: 'LIBRE', medicoAsignado: 'Lic. Ruiz' },
  ];

  private turnos: Turno[] = [];

  // -------------------------
  // BehaviorSubjects
  // -------------------------
  private turnosSubject = new BehaviorSubject<Turno[]>(this.turnos);
  private consultoriosSubject = new BehaviorSubject<Consultorio[]>(this.consultorios);
  private especialidadesSubject = new BehaviorSubject<Especialidad[]>(this.especialidades);

  turnos$ = this.turnosSubject.asObservable();
  consultorios$ = this.consultoriosSubject.asObservable();
  especialidades$ = this.especialidadesSubject.asObservable();

  // -------------------------
  // RECEPCIÓN
  // -------------------------
  getEspecialidades(): Especialidad[] {
    return this.especialidades;
  }

  validarDuplicado(documento: string, especialidadId: string): Turno | undefined {
    return this.turnos.find(t =>
      t.paciente.documento === documento &&
      t.especialidadId === especialidadId &&
      ['EN_ESPERA', 'LLAMADO', 'EN_ATENCION'].includes(t.estado)
    );
  }

  generarTurno(paciente: Paciente, especialidadId: string): Turno {
    const especialidad = this.especialidades.find(e => e.id === especialidadId);
    if (!especialidad) throw new Error('Especialidad no encontrada');

    const turnosEsp = this.turnos.filter(t => t.especialidadId === especialidadId);
    const lastNum = turnosEsp.length > 0 ? Math.max(...turnosEsp.map(t => t.numero)) : 0;
    const nextNum = lastNum + 1;

    const newTurno: Turno = {
      id: `${especialidad.prefijo}-${nextNum.toString().padStart(3, '0')}`,
      numero: nextNum,
      paciente,
      especialidadId,
      estado: 'EN_ESPERA',
      horaLlegada: new Date(),
    };

    this.turnos = [...this.turnos, newTurno];
    this.turnosSubject.next(this.turnos);
    return newTurno;
  }

  // -------------------------
  // PANEL MÉDICO
  // -------------------------
  cambiarEstadoConsultorio(consultorioId: string, estado: Consultorio['estado']) {
    this.consultorios = this.consultorios.map(c =>
      c.id === consultorioId ? { ...c, estado } : c
    );
    this.consultoriosSubject.next(this.consultorios);
  }

  llamarSiguiente(consultorioId: string): Turno | null {
    const consultorio = this.consultorios.find(c => c.id === consultorioId);
    if (!consultorio) return null;

    const turnosEnEspera = this.turnos
      .filter(t => t.especialidadId === consultorio.especialidadId && t.estado === 'EN_ESPERA')
      .sort((a, b) => a.horaLlegada.getTime() - b.horaLlegada.getTime());

    if (turnosEnEspera.length === 0) return null;

    const turnoALlamar = turnosEnEspera[0];

    this.turnos = this.turnos.map(t =>
      t.id === turnoALlamar.id ? { ...t, estado: 'LLAMADO', horaLlamado: new Date(), consultorioId } : t
    );
    this.turnosSubject.next(this.turnos);

    this.consultorios = this.consultorios.map(c =>
      c.id === consultorioId ? { ...c, turnoActualId: turnoALlamar.id } : c
    );
    this.consultoriosSubject.next(this.consultorios);

    return this.turnos.find(t => t.id === turnoALlamar.id) || null;
  }

  marcarAusente(turnoId: string) {
    this.turnos = this.turnos.map(t =>
      t.id === turnoId ? { ...t, estado: 'AUSENTE' } : t
    );
    this.turnosSubject.next(this.turnos);
    this.liberarConsultorioPorTurno(turnoId);
  }

  iniciarAtencion(turnoId: string) {
    this.turnos = this.turnos.map(t =>
      t.id === turnoId ? { ...t, estado: 'EN_ATENCION', horaInicioAtencion: new Date() } : t
    );
    this.turnosSubject.next(this.turnos);

    const turno = this.turnos.find(t => t.id === turnoId);
    if (turno?.consultorioId) {
      this.cambiarEstadoConsultorio(turno.consultorioId, 'EN_ATENCION');
    }
  }

  finalizarAtencion(turnoId: string) {
    this.turnos = this.turnos.map(t =>
      t.id === turnoId ? { ...t, estado: 'ATENDIDO', horaFin: new Date() } : t
    );
    this.turnosSubject.next(this.turnos);
    this.liberarConsultorioPorTurno(turnoId);
  }

  // -------------------------
  // FASE B: TRANSFERENCIA
  // -------------------------
  transferirPaciente(turnoId: string, nuevaEspecialidadId: string): Turno | null {
    const turnoOriginal = this.turnos.find(t => t.id === turnoId);
    if (!turnoOriginal) return null;

    // Cerrar el turno actual como TRANSFERIDO
    this.turnos = this.turnos.map(t =>
      t.id === turnoId ? { ...t, estado: 'TRANSFERIDO', horaFin: new Date() } : t
    );
    this.liberarConsultorioPorTurno(turnoId);

    // Crear nuevo turno en la especialidad destino heredando la horaLlegada original
    const espDestino = this.especialidades.find(e => e.id === nuevaEspecialidadId);
    if (!espDestino) return null;

    const turnosEsp = this.turnos.filter(t => t.especialidadId === nuevaEspecialidadId);
    const lastNum = turnosEsp.length > 0 ? Math.max(...turnosEsp.map(t => t.numero)) : 0;
    const nextNum = lastNum + 1;

    const nuevoTurno: Turno = {
      id: `${espDestino.prefijo}-${nextNum.toString().padStart(3, '0')}`,
      numero: nextNum,
      paciente: turnoOriginal.paciente,
      especialidadId: nuevaEspecialidadId,
      estado: 'EN_ESPERA',
      horaLlegada: turnoOriginal.horaLlegada, // Hereda la hora original
    };

    this.turnos = [...this.turnos, nuevoTurno];
    this.turnosSubject.next(this.turnos);
    return nuevoTurno;
  }

  // -------------------------
  // FASE C: ADMIN CRUD
  // -------------------------
  agregarEspecialidad(esp: Omit<Especialidad, 'id'>): Especialidad {
    const nueva: Especialidad = { ...esp, id: `ESP-${Date.now()}` };
    this.especialidades = [...this.especialidades, nueva];
    this.especialidadesSubject.next(this.especialidades);
    return nueva;
  }

  eliminarEspecialidad(id: string) {
    this.especialidades = this.especialidades.filter(e => e.id !== id);
    this.especialidadesSubject.next(this.especialidades);
  }

  agregarConsultorio(con: Omit<Consultorio, 'id' | 'estado'>): Consultorio {
    const nuevo: Consultorio = { ...con, id: `CON-${Date.now()}`, estado: 'LIBRE' };
    this.consultorios = [...this.consultorios, nuevo];
    this.consultoriosSubject.next(this.consultorios);
    return nuevo;
  }

  eliminarConsultorio(id: string) {
    this.consultorios = this.consultorios.filter(c => c.id !== id);
    this.consultoriosSubject.next(this.consultorios);
  }

  resetJornada() {
    this.turnos = [];
    this.turnosSubject.next(this.turnos);
    
    // Liberar todos los consultorios
    this.consultorios = this.consultorios.map(c => ({
      ...c,
      estado: 'LIBRE' as const,
      turnoActualId: undefined
    }));
    this.consultoriosSubject.next(this.consultorios);
  }

  // -------------------------
  // PRIVATE HELPERS
  // -------------------------
  private liberarConsultorioPorTurno(turnoId: string) {
    this.consultorios = this.consultorios.map(c =>
      c.turnoActualId === turnoId ? { ...c, estado: 'LIBRE', turnoActualId: undefined } : c
    );
    this.consultoriosSubject.next(this.consultorios);
  }
}
