import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../core/services/api.service';
import { SwalService } from '../../core/services/swal.service';
import { EspecialidadesService } from '../../core/services/especialidades.service';
import { normalizeString } from './recepcion-fechas.util';
import { RecepcionAutocompleteService, AutocompleteState } from './recepcion-autocomplete.service';
import { SedeDTO } from '@core/models/dto.models';

export interface SeleccionModel {
  id_servicio: number | null;
  id_responsable: number | null;
  id_cliente: number | null;
  id_atencion: number | null;
  id_especialidad: number | null;
  id_medico: number | null;
  id_consultorio: number | null;
  nombre_servicio_label: string;
  nombre_medico_label: string;
  nombre_especialidad_label?: string;
}

@Injectable({ providedIn: 'root' })
export class RecepcionSeleccionService {
  private api = inject(ApiService);
  private swal = inject(SwalService);
  private espService = inject(EspecialidadesService);
  private ac = inject(RecepcionAutocompleteService);

  servicios: any[] = [];
  especialidades: any[] = [];
  responsables: any[] = [];
  medicos: any[] = [];
  consultorios: any[] = [];
  sedes: SedeDTO[] = [];
  seleccion: SeleccionModel = { id_servicio: null, id_responsable: null, id_cliente: null, id_atencion: null, id_especialidad: null, id_medico: null, id_consultorio: null, nombre_servicio_label: '', nombre_medico_label: '' };
  categoriaServicio = '';
  showPayerDropdown = false; showServiceDropdown = false; showEspecialidadDropdown = false; showMedicoDropdown = false; showAseguradoraDropdown = false;
  acAseguradora: AutocompleteState = this.ac.createState();
  acEspecialidad: AutocompleteState = this.ac.createState();
  acMedico: AutocompleteState = this.ac.createState();
  private _aseguradorasRef: any[] = [];

  get aseguradoraFiltro() { return this.acAseguradora.filtro; }
  set aseguradoraFiltro(v: string) { this.acAseguradora.filtro = v; }
  get especialidadFiltro() { return this.acEspecialidad.filtro; }
  set especialidadFiltro(v: string) { this.acEspecialidad.filtro = v; }
  get medicoFiltro() { return this.acMedico.filtro; }
  set medicoFiltro(v: string) { this.acMedico.filtro = v; }
  get aseguradoraIndex() { return this.acAseguradora.index; }
  set aseguradoraIndex(v: number) { this.acAseguradora.index = v; }
  get especialidadIndex() { return this.acEspecialidad.index; }
  set especialidadIndex(v: number) { this.acEspecialidad.index = v; }
  get medicoIndex() { return this.acMedico.index; }
  set medicoIndex(v: number) { this.acMedico.index = v; }
  get aseguradorasFiltradas(): any[] { const q = (this.aseguradoraFiltro || '').trim().toLowerCase(); return this._aseguradorasRef.filter((a: any) => !q || (a.aseguradora || '').toLowerCase().includes(q)); }
  get especialidadesFiltradas(): any[] { const q = (this.especialidadFiltro || '').trim().toLowerCase(); return this.getEspecialidades().filter((s: any) => !q || (s.nombre || s.nombre_servicio || '').toLowerCase().includes(q)); }
  get medicosConFiltro(): any[] { const q = (this.medicoFiltro || '').trim().toLowerCase(); return this.getMedicosFiltrados().filter((m: any) => !q || ((m.nombre || '') + ' ' + (m.apellido || '')).toLowerCase().includes(q)); }

  setAseguradorasRef(a: any[]) { this._aseguradorasRef = a; }

  cargarDatosMaestros(cargarAseguradorasCb: () => void) {
    this.api.getServicios().subscribe({ next: (d: any) => { this.servicios = d; }, error: (e: any) => console.error('Error cargando servicios:', e) });
    this.espService.getAllEspecialidades().subscribe({ next: (d: any) => { this.especialidades = d; }, error: (e: any) => console.error('Error cargando especialidades:', e) });
    cargarAseguradorasCb();
    this.api.get('recepcion/responsables-pago').subscribe({ next: (d: any) => this.responsables = d, error: (e: any) => console.error('Error cargando responsables:', e) });
    this.api.getPersonal('medico').subscribe({ next: (d: any) => { this.medicos = d; }, error: (e: any) => console.error('Error cargando medicos:', e) });
    this.api.getConsultorios().subscribe({ next: (d: any) => { this.consultorios = d; }, error: (e: any) => console.error('Error cargando consultorios:', e) });
  }

  getSedeNombre(id: number | string | null | undefined): string {
    if (id === undefined || id === null || id === '') return 'SIN ASIGNAR';
    const fId = Number(id); if (isNaN(fId)) return 'SIN ASIGNAR';
    const s = this.sedes.find((s: SedeDTO) => Number(s.id_sede) === fId || Number(s.id) === fId);
    return s ? s.nombre.toUpperCase() : 'SIN ASIGNAR';
  }

  resetSeleccion() { this.seleccion = { id_servicio: null, id_responsable: null, id_cliente: null, id_atencion: null, id_especialidad: null, id_medico: null, id_consultorio: null, nombre_servicio_label: '', nombre_medico_label: '' }; this.categoriaServicio = ''; this.aseguradoraFiltro = ''; this.especialidadFiltro = ''; this.medicoFiltro = ''; }

  selectPayer(id: number) { if (this.seleccion.id_responsable === id) { this.showPayerDropdown = false; return; } this.seleccion.id_responsable = id; this.showPayerDropdown = false; if (id !== 2) this.seleccion.id_cliente = null; this.seleccion.id_servicio = null; this.seleccion.id_especialidad = null; this.seleccion.id_medico = null; this.seleccion.id_consultorio = null; this.seleccion.nombre_medico_label = ''; this.seleccion.nombre_servicio_label = ''; this.categoriaServicio = ''; this.aseguradoraFiltro = ''; this.especialidadFiltro = ''; this.medicoFiltro = ''; }
  selectAseguradora(id: number) { this.seleccion.id_cliente = id; this.showAseguradoraDropdown = false; this.aseguradoraIndex = -1; const a = this._aseguradorasRef.find((x: any) => x.id_cliente === id); this.aseguradoraFiltro = a ? a.aseguradora : ''; }
  selectCategoria(cat: string) { if (this.categoriaServicio === cat) { this.showServiceDropdown = false; return; } this.categoriaServicio = cat; this.showServiceDropdown = false; this.seleccion.id_servicio = null; this.seleccion.id_especialidad = null; this.seleccion.id_medico = null; this.seleccion.id_consultorio = null; this.seleccion.nombre_medico_label = ''; this.seleccion.nombre_servicio_label = ''; this.especialidadFiltro = ''; this.medicoFiltro = ''; if (cat !== 'Consulta') { const ns = normalizeString(cat); const s = this.servicios.find((sv: any) => normalizeString(sv.nombre || sv.nombre_servicio || '').includes(ns)); if (s) this.seleccion.id_servicio = s.id || s.id_servicio; else { this.swal.warning(`El servicio de ${cat} no esta configurado para esta sede.`); this.categoriaServicio = ''; } } }
  selectEspecialidad(item: any) { if (this.categoriaServicio === 'Consulta') { this.seleccion.id_servicio = item.id_servicio; this.seleccion.id_especialidad = item.id_especialidad || item.id; this.seleccion.nombre_servicio_label = item.nombre || ''; this.seleccion.id_medico = null; this.seleccion.id_consultorio = null; this.seleccion.nombre_medico_label = ''; } else { this.seleccion.id_servicio = item.id || item.id_servicio; this.seleccion.id_especialidad = null; this.seleccion.nombre_servicio_label = item.nombre || item.nombre_servicio || ''; } this.especialidadFiltro = item.nombre || item.nombre_servicio || ''; this.especialidadIndex = -1; this.showEspecialidadDropdown = false; }
  selectMedico(m: any) { this.seleccion.id_medico = m.id_usuario || m.id; let c = m.id_consultorio || m.consultorio_id || null; const t = this.seleccion.id_especialidad ? Number(this.seleccion.id_especialidad) : null; if (t != null) { const cm = m.especialidades_consultorios; if (cm && typeof cm === 'object' && cm[t] != null) c = Number(cm[t]); } this.seleccion.id_consultorio = c; this.seleccion.nombre_medico_label = ((m.nombre || '') + ' ' + (m.apellido || '')).trim(); this.medicoFiltro = this.seleccion.nombre_medico_label; this.medicoIndex = -1; this.showMedicoDropdown = false; }
  getEspecialidades(): any[] { if (!this.categoriaServicio) return this.especialidades.filter((e: any) => e.activo !== false); if (this.categoriaServicio === 'Consulta') return this.especialidades.filter((e: any) => e.activo !== false); if (this.categoriaServicio === 'Laboratorio') return this.servicios.filter((s: any) => (s.nombre || s.nombre_servicio || '').toLowerCase().includes('laboratorio')); if (this.categoriaServicio === 'Imagenes') return this.servicios.filter((s: any) => (s.nombre || s.nombre_servicio || '').toLowerCase().includes('imagen')); return []; }
  getMedicosFiltrados(): any[] { if (!this.seleccion.id_especialidad) return []; const t = Number(this.seleccion.id_especialidad); return this.medicos.filter((m: any) => { const inact = Array.isArray(m.especialidades_inactivas) ? m.especialidades_inactivas.map(Number) : []; if (inact.includes(t)) return false; if (Number(m.id_especialidad || m.especialidad_id) === t) return true; const ex = m.especialidades; return Array.isArray(ex) && ex.some((e: any) => Number(e) === t); }); }
  getNombreAseguradoraSeleccionada(id: any): string { if (!id) return 'Seleccione...'; const a = this._aseguradorasRef.find((x: any) => x.id_cliente === id); return a ? a.aseguradora : 'Seleccione...'; }
  getNombreResponsable(id: any): string { if (!id) return 'Seleccione...'; const r = this.responsables.find((x: any) => x.id === id); const n = r?.nombre || (id === 1 ? 'Particular' : id === 2 ? 'Seguro' : 'Seleccione...'); return this.getResponsableLabel(n); }
  getAseguradoraNombre(a: any): string { return a?.modalidad_pago || 'SIN NOMBRE'; }
  getResponsableLabel(v: any): string { if (!v || v === 'PENDIENTE') return 'SIN ASIGNAR'; return v.toString().toUpperCase().includes('PARTICULAR') ? 'PARTICULAR' : 'ASEGURADORA'; }
  getResponsableClass(v: any): string { const m = (v || '').toString().trim().toLowerCase(); if (m.includes('particular')) return 'text-blue-600'; if (m.includes('seguro') || m.includes('asegur')) return 'text-green-600'; return 'text-slate-600 dark:text-slate-400'; }
  getServicioCategoria(v: any): string { const s = (v || '').toString().trim().toLowerCase(); if (s.includes('laboratorio')) return 'Laboratorio'; if (s.includes('imagenes') || s.includes('imagen')) return 'Imagenes'; return 'Consulta'; }
  getNombreMedicoLabel(id: any): string { if (!id) return 'Seleccione medico...'; if (this.seleccion.nombre_medico_label) return this.seleccion.nombre_medico_label; const m = this.medicos.find((d: any) => (d.id_usuario || d.id) === id); return m ? ((m.nombre || '') + ' ' + (m.apellido || '')).trim() : 'Seleccione medico...'; }
  getMedicoConsultorio(): string { if (!this.seleccion.id_consultorio) return ''; const c = this.consultorios.find((x: any) => x.id == this.seleccion.id_consultorio); return c ? c.nombre : ''; }
  getNombreServicioLabel(id: any): string { if (this.seleccion.nombre_servicio_label) return this.seleccion.nombre_servicio_label; if (!id) return 'Seleccione...'; const s = this.servicios.find((sv: any) => (sv.id || sv.id_servicio) === id); return s ? (s.nombre || s.nombre_servicio || 'Seleccione...') : 'Seleccione...'; }
}
