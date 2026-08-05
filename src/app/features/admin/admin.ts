import { Component, inject, OnInit, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '@core/services/api.service';
import { AuthService } from '@core/services/auth.service';
import { ThemeService } from '@core/services/theme.service';
import { Header } from '../../shared/components/header/header';
import { Sidebar } from '../../shared/components/sidebar/sidebar';
import { AdminReports } from './admin-reports';
import { AdminPersonal } from './admin-personal';
import { AdminEspecialidades } from './admin-especialidades';
import { AdminRoles } from './admin-roles';
import { AdminPermisologia } from './admin-permisologia';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, Sidebar, Header, AdminReports, AdminPersonal, AdminEspecialidades, AdminRoles, AdminPermisologia],
  templateUrl: './admin.html',
  styles: [],
})
/**
 * Panel de administración principal.
 * Orquesta los subcomponentes de personal, especialidades, roles, permisología y reportes.
 * Si el administrador no tiene permisos, siembra los predeterminados al iniciar.
 */
export class Admin implements OnInit {
   private apiService = inject(ApiService);
   private authService = inject(AuthService);
   private themeService = inject(ThemeService);
   private route = inject(ActivatedRoute);
   private destroyRef = inject(DestroyRef);

   usuario = this.authService.usuarioActual;

   activeTab:
      | 'reports'
      | 'stats'
      | 'config'
      | 'personal'
      | 'especialidades'
      | 'roles'
      | 'permisologia' = 'personal';

   configExpanded = true;
  sidebarOpen = false;
  cargando = false;
  permisosListos = false;

  /** Indica si el usuario puede ver una pestaña del panel según sus permisos. */
  puedeVerTab(tab: string): boolean {
    const usuario = this.authService.usuarioActual;
    if (usuario?.rol === 'administrador') return true;
    const p = usuario?.permisos || [];
    const tiene = (...claves: string[]) => p.some(k => k === '*:*' || claves.includes(k));
    switch (tab) {
      case 'reports':
      case 'stats':
        return tiene('reportes:ver', 'reportes:*');
      case 'personal':
        return tiene('personal:ver', 'personal:*');
      case 'roles':
        return tiene('roles:ver', 'roles:*');
      case 'permisologia':
        return tiene('permisologia:ver', 'permisologia:*', 'permisologia:gestionar_permisos');
      case 'especialidades':
        return tiene('especialidades:ver', 'especialidades:*');
      default:
        return false;
    }
  }

  private tabPorDefecto(): Admin['activeTab'] {
    const tabs: Admin['activeTab'][] = ['reports', 'personal', 'roles', 'permisologia', 'especialidades'];
    return tabs.find(t => this.puedeVerTab(t)) || 'especialidades';
  }

  ngOnInit() {
    const usuario = this.authService.usuarioActual;
    const esAdmin = usuario?.rol === 'administrador';
    const tieneReportes = usuario?.permisos?.some(p => p === 'reportes:*' || p === 'reportes:ver' || p === '*:*');
    const tienePermisologia = usuario?.permisos?.some(p => p === 'permisologia:*' || p === 'permisologia:gestionar_permisos' || p === '*:*');
    const necesitaSeed = esAdmin && (
      !usuario?.permisos ||
      usuario.permisos.length === 0 ||
      !tieneReportes ||
      !tienePermisologia
    );

    if (necesitaSeed) {
      this.apiService.seedPermisosAdmin().subscribe({
        next: () => {
          this.authService.refrescarPermisos().subscribe({
            next: () => { this.permisosListos = true; },
            error: () => { this.permisosListos = true; },
          });
        },
        error: () => { this.permisosListos = true; },
      });
    } else {
      this.permisosListos = true;
    }
    const savedTab = sessionStorage.getItem('admin_activeTab') as Admin['activeTab'] | null;
    if (savedTab && this.puedeVerTab(savedTab)) {
      this.activeTab = savedTab;
    }
    if (!this.puedeVerTab(this.activeTab)) {
      this.activeTab = this.tabPorDefecto();
    }
    this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      if (params['tab']) {
        const tab = params['tab'] as Admin['activeTab'];
        if (this.puedeVerTab(tab)) {
          this.activeTab = tab;
          sessionStorage.setItem('admin_activeTab', tab);
        }
      }
    });
  }

  cambiarTab(tab: string) {
    this.activeTab = tab as Admin['activeTab'];
    this.sidebarOpen = false;
    sessionStorage.setItem('admin_activeTab', tab);
  }

  toggleConfig() {
    this.configExpanded = !this.configExpanded;
  }

  logout() {
    this.cargando = true;
    const MIN_CARGANDO = 800;

    setTimeout(() => {
      this.authService.logout();
      this.cargando = false;
    }, MIN_CARGANDO);
  }
}
