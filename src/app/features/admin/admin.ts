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

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, Sidebar, Header, AdminReports, AdminPersonal, AdminEspecialidades],
  templateUrl: './admin.html',
  styles: [],
})
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
    | 'medicos'
    | 'recepcionistas'
    | 'administradores'
    | 'laboratorio'
    | 'imagenes'
    | 'aps' = 'reports';

  configExpanded = true;
  sidebarOpen = false;

  ngOnInit() {
    const savedTab = sessionStorage.getItem('admin_activeTab');
    if (savedTab) {
      this.activeTab = savedTab as Admin['activeTab'];
    }
    this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      if (params['tab']) {
        this.activeTab = params['tab'] as Admin['activeTab'];
        sessionStorage.setItem('admin_activeTab', params['tab']);
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
    this.authService.logout();
  }
}
