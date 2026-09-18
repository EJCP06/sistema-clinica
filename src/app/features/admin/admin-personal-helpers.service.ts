import { Injectable } from '@angular/core';
import { ServicioDTO, EspecialidadDTO, ConsultorioDTO, SedeDTO } from '@core/models/dto.models';

@Injectable({ providedIn: 'root' })
export class AdminPersonalHelpers {
  normalize(str: string): string {
    return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  getNombreEsp(especialidades: EspecialidadDTO[], id: string | number | undefined, forDropdown = false): string {
    const esp = especialidades.find((e) => e.id === id || e.id_especialidad == id);
    return esp ? esp.nombre : forDropdown ? 'Seleccione...' : 'SIN ASIGNAR';
  }

  getNombreServicio(servicios: ServicioDTO[], id: string | number | undefined, forDropdown = false): string {
    const s = servicios.find((sv) => sv.id == id);
    return s ? s.nombre : forDropdown ? 'Seleccione...' : 'SIN ASIGNAR';
  }

  getNombreCon(consultorios: ConsultorioDTO[], id: number | string | null | undefined, forDropdown = false): string {
    if (id === null || id === undefined) return forDropdown ? 'Seleccione...' : 'SIN ASIGNAR';
    const con = consultorios.find((c) => c.id == id);
    return con ? con.nombre.toUpperCase() : forDropdown ? 'Seleccione...' : 'SIN ASIGNAR';
  }

  getConsultoriosEspLabel(consultorios: ConsultorioDTO[], ids: number[]): string {
    if (!ids || ids.length === 0) return 'SIN ASIGNAR';
    return ids.map(id => {
      const con = consultorios.find(c => c.id == id);
      return con ? con.nombre.toUpperCase() : `#${id}`;
    }).join(', ');
  }

  getSedeLabel(sedes: SedeDTO[], id: number | string | null | undefined, forDropdown = false): string {
    if (id === undefined || id === null || id === '') return forDropdown ? 'Seleccione...' : 'SIN ASIGNAR';
    const finalId = Number(id);
    if (isNaN(finalId)) return forDropdown ? 'Seleccione...' : 'SIN ASIGNAR';
    const sede = sedes.find((s) => Number(s.id_sede) === finalId || Number(s.id) === finalId);
    if (!sede) return forDropdown ? 'Seleccione...' : 'SIN ASIGNAR';
    return forDropdown ? this.toTitleCase(sede.nombre) : sede.nombre.toUpperCase();
  }

  getSedeNombre(sedes: SedeDTO[], id: number | string | null | undefined): string {
    if (id === undefined || id === null || id === '') return '';
    const finalId = Number(id);
    if (isNaN(finalId)) return '';
    const sede = sedes.find((s) => Number(s.id_sede) === finalId || Number(s.id) === finalId);
    return sede ? sede.nombre : '';
  }

  getSedeIdByName(sedes: SedeDTO[], nombre: string): number | null {
    if (!nombre) return null;
    const normalized = nombre.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const sede = sedes.find((s) =>
      (s.nombre || '').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === normalized
    );
    return sede ? Number(sede.id_sede || sede.id) : null;
  }

  toTitleCase(str: string): string {
    if (!str) return '';
    return str.toLowerCase().split(' ').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  }

  getRolLabel(rol: string): string {
    const labels: { [key: string]: string } = {
      administrador: 'Administrador', medico: 'Medico', recepcionista: 'Recepcionista',
      laboratorio: 'Laboratorio', imagenes: 'Imagenes', coordinador: 'Coordinador', analista: 'Analista',
    };
    return labels[rol] || 'Seleccione...';
  }

  getRolBadgeClass(rol: string): string {
    const classes: { [key: string]: string } = {
      administrador: 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20',
      medico: 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
      recepcionista: 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
      laboratorio: 'bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/20',
      imagenes: 'bg-cyan-50 text-cyan-600 border-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-400 dark:border-cyan-500/20',
      coordinador: 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20',
      analista: 'bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20',
    };
    return classes[rol] || 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20';
  }

  filterPersonal(personal: any[], query: string, searchFilter: string): any[] {
    return personal.filter((p) => {
      const q = this.normalize(query || '');
      if (!q) return true;
      const matchNombre = this.normalize(((p.nombre || '') + ' ' + (p.segundo_nombre || '')).trim()).includes(q);
      const matchApellido = this.normalize(((p.apellido || '') + ' ' + (p.segundo_apellido || '')).trim()).includes(q);
      const matchCedula = (p.cedula || '').toLowerCase().includes(query.toLowerCase());
      const matchRol = this.normalize(this.getRolLabel(p.rol)).includes(q);
      if (searchFilter === 'nombre') return matchNombre;
      if (searchFilter === 'apellido') return matchApellido;
      if (searchFilter === 'cedula') return matchCedula;
      if (searchFilter === 'rol') return matchRol;
      return matchNombre || matchApellido || matchCedula || matchRol;
    });
  }
}
