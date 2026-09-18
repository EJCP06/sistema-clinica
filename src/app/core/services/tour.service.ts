import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TourService as NgxTourService, IStepOption } from 'ngx-ui-tour-md-menu';
import { AuthService } from './auth.service';
import { buildSidebarSteps, TourStep, TourModuleConfig } from '../config/tour-steps.config';

const TOUR_SEEN_KEY = 'clinica_tour_seen';
const SIDEBAR_KEYS = { panel: 'sb_panel', operaciones: 'sb_operaciones', admin: 'sb_admin' };

/**
 * Servicio central del tour guiado.
 *
 * Filtra los pasos según los permisos del usuario, navega a las rutas
 * correspondientes y expande las secciones del sidebar antes de mostrar
 * cada tooltip.
 */
@Injectable({ providedIn: 'root' })
export class TourGuideService {
  private readonly tourService = inject(NgxTourService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  private filteredSteps: IStepOption[] = [];

  constructor() {
    this.tourService.end$.subscribe(() => {
      this.markAsSeen();
    });
  }

  /**
   * Construye la lista de pasos filtrando por permisos del usuario.
   */
  private buildSteps(): TourStep[] {
    const usuario = this.auth.usuarioActual;
    if (!usuario) return [];

    return buildSidebarSteps({
      tienePermiso: (p) => this.auth.tienePermiso(p),
      rol: usuario.rol || '',
    });
  }

  /**
   * Expande una sección del sidebar usando sessionStorage.
   * El sidebar lee estas keys para determinar qué sección está abierta.
   */
  private expandSection(section: 'panel' | 'operaciones' | 'admin'): void {
    sessionStorage.setItem(SIDEBAR_KEYS[section], '1');
  }

  /**
   * Colapsa todas las secciones del sidebar.
   */
  private collapseAllSections(): void {
    Object.values(SIDEBAR_KEYS).forEach((key) => sessionStorage.setItem(key, '0'));
  }

  /**
   * Inicia el tour guiado.
   *
   * Reconstruye los pasos cada vez para reflejar permisos actuales.
   * Para cada paso:
   *   1. Expande la sección del sidebar si se indica
   *   2. Navega a la ruta si se indica
   *   3. Espera a que la navegación complete
   *   4. Inicializa ngx-ui-tour con los pasos filtrados
   */
  start(): void {
    this.filteredSteps = this.buildSteps();

    if (this.filteredSteps.length === 0) return;

    // Expandir secciones del sidebar para que los anchors estén visibles
    this.collapseAllSections();
    for (const step of this.filteredSteps) {
      if ('expandSection' in step && step.expandSection) {
        this.expandSection(step.expandSection as 'panel' | 'operaciones' | 'admin');
      }
    }

    // Navegar al primer paso si tiene ruta
    const firstStep = this.filteredSteps[0];
    const firstRoute = firstStep && 'route' in firstStep ? (firstStep as TourStep).route : undefined;
    const navigation$ = firstRoute
      ? this.router.navigateByUrl(firstRoute)
      : Promise.resolve(true);

    navigation$.then(() => {
      this.tourService.initialize(this.filteredSteps, {
        showProgress: true,
        enableBackdrop: true,
        nextBtnTitle: 'Siguiente',
        prevBtnTitle: 'Anterior',
        endBtnTitle: 'Finalizar',
      });

      this.tourService.start();
    });
  }

  end(): void {
    this.tourService.end();
  }

  hasSeen(): boolean {
    const usuario = this.auth.usuarioActual;
    if (!usuario) return false;
    return localStorage.getItem(`${TOUR_SEEN_KEY}_${usuario.id}`) === 'true';
  }

  private markAsSeen(): void {
    const usuario = this.auth.usuarioActual;
    if (!usuario) return;
    localStorage.setItem(`${TOUR_SEEN_KEY}_${usuario.id}`, 'true');
  }

  resetSeen(): void {
    const usuario = this.auth.usuarioActual;
    if (!usuario) return;
    localStorage.removeItem(`${TOUR_SEEN_KEY}_${usuario.id}`);
  }

  get totalSteps(): number {
    return this.buildSteps().length;
  }

  get availableModules(): TourModuleConfig[] {
    const usuario = this.auth.usuarioActual;
    if (!usuario) return [];

    // Módulos ficticios para el panel de ayuda del help-button
    const allModules: TourModuleConfig[] = [
      { permiso: 'admision:ver', label: 'Admisión de Pacientes', steps: [] },
      { permiso: 'aps:ver', label: 'Atención APS', steps: [] },
      { permiso: 'laboratorio:ver', label: 'Atención Laboratorio', steps: [] },
      { permiso: 'imagenes:ver', label: 'Atención Imágenes', steps: [] },
      { permiso: 'atencion_medica:ver', label: 'Atención Médica', steps: [] },
      { permiso: 'personal:ver', label: 'Administración', steps: [] },
    ];

    return allModules.filter(
      (m) => usuario.rol === 'administrador' || this.auth.tienePermiso(m.permiso)
    );
  }
}
