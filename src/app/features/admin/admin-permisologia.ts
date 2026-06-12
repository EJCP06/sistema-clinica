import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '@core/services/api.service';
import { SwalService } from '../../core/services/swal.service';
import { LucideAngularModule, ShieldCheck, CheckCircle2, XCircle, Plus, ChevronDown, Check } from 'lucide-angular';
import { RolDTO } from '@core/models/dto.models';
import { PERMISOS_GRUPALES, getAccionLabel } from '@core/config/permisos.config';

interface ModuloPermiso {
  key: string;
  label: string;
  permisos: string[];
}

@Component({
  selector: 'app-admin-permisologia',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './admin-permisologia.html',
})
export class AdminPermisologia implements OnInit {
  readonly ShieldCheck = ShieldCheck;
  readonly CheckCircle2 = CheckCircle2;
  readonly XCircle = XCircle;
  readonly Plus = Plus;
  readonly ChevronDown = ChevronDown;
  readonly Check = Check;

  private api = inject(ApiService);
  private swal = inject(SwalService);

  roles: RolDTO[] = [];
  permisosPorRol: Record<number, string[]> = {};

  showModal = false;
  showDetalle = false;
  selectedRol: RolDTO | null = null;
  selectedModulo: ModuloPermiso | null = null;
  permisosTemp: string[] = [];
  isSaving = false;
  dropdownOpen: string | null = null;

  get modulosDisponibles(): ModuloPermiso[] {
    return Object.entries(PERMISOS_GRUPALES).map(([label, permisos]) => ({
      key: label.toLowerCase().replace(/ /g, '_'),
      label,
      permisos,
    }));
  }

  get permisosTodos(): string[] {
    return [...new Set(this.modulosDisponibles.flatMap(m => m.permisos))];
  }

  ngOnInit() {
    this.cargarRoles();
  }

  cargarRoles() {
    this.api.getRoles().subscribe({
      next: (r) => {
        this.roles = r;
        this.cargarPermisosDeRoles();
      },
      error: () => this.swal.error('Error al cargar roles'),
    });
  }

  private cargarPermisosDeRoles() {
    for (const rol of this.roles) {
      this.api.getPermisosByRol(rol.id).subscribe({
        next: (permisos) => {
          this.permisosPorRol[rol.id] = permisos.map(p => p.key);
        },
      });
    }
  }

  toggleDropdown(tipo: string) {
    this.dropdownOpen = this.dropdownOpen === tipo ? null : tipo;
  }

  selectRol(rol: RolDTO) {
    this.selectedRol = rol;
    this.dropdownOpen = null;
    this.selectedModulo = null;
    this.permisosTemp = [];
    // Cargar permisos actuales del rol
    this.api.getPermisosByRol(rol.id).subscribe({
      next: (permisos) => {
        this.permisosTemp = permisos.map(p => p.key);
        this.permisosPorRol[rol.id] = [...this.permisosTemp];
      },
    });
  }

  selectModulo(modulo: ModuloPermiso) {
    this.selectedModulo = modulo;
    this.dropdownOpen = null;
  }

  getLabel(key: string): string {
    return getAccionLabel(key);
  }

  togglePermisoTemp(key: string) {
    const idx = this.permisosTemp.indexOf(key);
    if (idx === -1) this.permisosTemp.push(key);
    else this.permisosTemp.splice(idx, 1);
  }

  abrirDetalle(rol: RolDTO) {
    this.selectedRol = rol;
    this.permisosTemp = [];
    this.api.getPermisosByRol(rol.id).subscribe({
      next: (permisos) => {
        this.permisosTemp = permisos.map(p => p.key);
        this.permisosPorRol[rol.id] = [...this.permisosTemp];
        this.showDetalle = true;
      },
    });
  }

  cerrarDetalle() {
    this.showDetalle = false;
    this.selectedRol = null;
    this.permisosTemp = [];
  }

  eliminarPermiso(key: string) {
    const idx = this.permisosTemp.indexOf(key);
    if (idx !== -1) {
      this.permisosTemp.splice(idx, 1);
    }
  }

  guardarDetalle() {
    if (!this.selectedRol || this.isSaving) return;
    this.isSaving = true;
    this.api.asignarPermisos(this.selectedRol.id, this.permisosTemp).subscribe({
      next: () => {
        this.isSaving = false;
        this.permisosPorRol[this.selectedRol!.id] = [...this.permisosTemp];
        this.cerrarDetalle();
        this.swal.success('Permisos actualizados correctamente');
      },
      error: (err) => {
        this.isSaving = false;
        this.swal.error(err.error?.mensaje || 'Error al asignar permisos');
      },
    });
  }

  getModulosConPermisos(): { label: string; permisos: string[] }[] {
    if (!this.permisosTemp.length) return [];
    const modulos: { label: string; permisos: string[] }[] = [];
    for (const [label, perms] of Object.entries(PERMISOS_GRUPALES)) {
      const asignados = perms.filter(p => this.permisosTemp.includes(p));
      if (asignados.length > 0) {
        modulos.push({ label, permisos: asignados });
      }
    }
    return modulos;
  }

  abrirModal(rol?: RolDTO) {
    if (rol) {
      this.selectedRol = rol;
      this.selectedModulo = null;
      this.permisosTemp = [];
      this.api.getPermisosByRol(rol.id).subscribe({
        next: (permisos) => {
          this.permisosTemp = permisos.map(p => p.key);
          this.permisosPorRol[rol.id] = [...this.permisosTemp];
          this.showModal = true;
        },
      });
    } else {
      this.selectedRol = null;
      this.selectedModulo = null;
      this.permisosTemp = [];
      this.showModal = true;
    }
  }

  cerrarModal() {
    this.showModal = false;
    this.selectedRol = null;
    this.selectedModulo = null;
    this.permisosTemp = [];
    this.dropdownOpen = null;
  }

  guardar() {
    if (!this.selectedRol || this.isSaving) return;
    this.isSaving = true;
    this.api.asignarPermisos(this.selectedRol.id, this.permisosTemp).subscribe({
      next: () => {
        this.isSaving = false;
        this.permisosPorRol[this.selectedRol!.id] = [...this.permisosTemp];
        this.cerrarModal();
        this.swal.success('Permisos actualizados correctamente');
      },
      error: (err) => {
        this.isSaving = false;
        this.swal.error(err.error?.mensaje || 'Error al asignar permisos');
      },
    });
  }
}
