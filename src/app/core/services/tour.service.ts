import { Injectable, inject, OnDestroy, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { TourService as NgxTourService, IStepOption } from 'ngx-ui-tour-md-menu';
import { AuthService } from './auth.service';
import { buildSidebarSteps, TourStep, TourModuleConfig } from '../config/tour-steps.config';

const TOUR_SEEN_KEY = 'clinica_tour_seen';
const SIDEBAR_KEYS = { panel: 'sb_panel', operaciones: 'sb_operaciones', admin: 'sb_admin' };

@Injectable({ providedIn: 'root' })
export class TourGuideService implements OnDestroy {
  private readonly tourService = inject(NgxTourService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly ngZone = inject(NgZone);

  private filteredSteps: TourStep[] = [];
  private stepShowSub?: any;

  constructor() {
    this.tourService.end$.subscribe(() => {
      this.collapseAllSections();
      this.markAsSeen();
    });
  }

  ngOnDestroy(): void {
    this.stepShowSub?.unsubscribe();
  }

  private buildSteps(): TourStep[] {
    const usuario = this.auth.usuarioActual;
    if (!usuario) return [];
    return buildSidebarSteps({
      tienePermiso: (p) => this.auth.tienePermiso(p),
      rol: usuario.rol || '',
    });
  }

  expandSection(section: 'panel' | 'operaciones' | 'admin'): void {
    sessionStorage.setItem(SIDEBAR_KEYS[section], '1');
  }

  private collapseAllSections(): void {
    Object.values(SIDEBAR_KEYS).forEach((key) => sessionStorage.setItem(key, '0'));
  }

  private setupStepHandlers(): void {
    this.stepShowSub = this.tourService.stepShow$.subscribe((event: any) => {
      const step = event.step || event;
      const tourStep = this.filteredSteps.find((s) => s.anchorId === step?.anchorId);
      if (tourStep?.expandSection) {
        this.expandSection(tourStep.expandSection);
      }
    });
  }

  start(): void {
    this.filteredSteps = this.buildSteps();
    if (this.filteredSteps.length === 0) return;

    this.collapseAllSections();

    const firstStep = this.filteredSteps[0];
    if (firstStep?.expandSection) {
      this.expandSection(firstStep.expandSection);
    }

    const firstRoute = firstStep?.route;
    const navigation$ = firstRoute
      ? this.router.navigateByUrl(firstRoute)
      : Promise.resolve(true);

    navigation$.then(() => {
      // Configurar el tour antes de iniciarlo
      this.tourService.initialize(this.filteredSteps, {
        showProgress: true,
        enableBackdrop: true,
        closeOnOutsideClick: false,
        nextBtnTitle: 'Siguiente',
        prevBtnTitle: 'Anterior',
        endBtnTitle: 'Finalizar',
      });

      // Configurar eventos manualmente ya que ngx-ui-tour-md-menu no expone beforeStepShow directamente
      this.setupStepHandlers();
      
      this.tourService.start();
    });
  }

  expandNextSection(): void {
    try {
      const currentAnchorId = this.tourService.currentStep?.anchorId;
      const currentIdx = currentAnchorId
        ? this.filteredSteps.findIndex((s) => s.anchorId === currentAnchorId)
        : -1;
      const nextStep = this.filteredSteps[currentIdx + 1];
      if (nextStep?.expandSection) {
        this.expandSection(nextStep.expandSection);
      }
    } catch {
      // silent fail
    }
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
    const allModules: TourModuleConfig[] = [
      { permiso: 'admision:ver', label: 'Admisión de Pacientes', steps: [] },
      { permiso: 'aps:ver', label: 'Atención APS', steps: [] },
      { permiso: 'laboratorio:ver', label: 'Atención Laboratorio', steps: [] },
      { permiso: 'imagenes:ver', label: 'Atención Imágenes', steps: [] },
      { permiso: 'atencion_medica:ver', label: 'Atención Médica', steps: [] },
      { permiso: 'aseguradoras:ver', label: 'Gestión de Aseguradoras', steps: [] },
      { permiso: 'especialidades:ver', label: 'Gestión de Especialidades', steps: [] },
      { permiso: 'personal:ver', label: 'Administración', steps: [] },
    ];
    return allModules.filter(
      (m) => usuario.rol === 'administrador' || this.auth.tienePermiso(m.permiso)
    );
  }
}
