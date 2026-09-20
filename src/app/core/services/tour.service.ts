import { Injectable, inject, OnDestroy, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { TourService as NgxTourService, IStepOption } from 'ngx-ui-tour-md-menu';
import { AuthService } from './auth.service';
import { buildSidebarSteps, TourStep, TourModuleConfig } from '../config/tour-steps.config';

const TOUR_SEEN_KEY = 'clinica_tour_seen';
const TOUR_STEP_KEY = 'clinica_tour_step';
const TOUR_PROGRESS_KEY = 'clinica_tour_progress';
const SIDEBAR_KEYS = { panel: 'sb_panel', operaciones: 'sb_operaciones', admin: 'sb_admin' };

@Injectable({ providedIn: 'root' })
export class TourGuideService implements OnDestroy {
  private readonly tourService = inject(NgxTourService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly ngZone = inject(NgZone);

  private filteredSteps: TourStep[] = [];
  private stepShowSub?: any;
  private _resuming = false;
  private _lastShownAnchorId: string | null = null;

  constructor() {
    this.tourService.end$.subscribe(() => {
      if (!this._resuming) {
        this.collapseAllSections();
      }
      // Solo marcar como completado si se vio el último paso
      const isLastStep = this._lastShownAnchorId && this.filteredSteps.length > 0 &&
        this.filteredSteps[this.filteredSteps.length - 1]?.anchorId === this._lastShownAnchorId;
      if (isLastStep) {
        this.markAsSeen();
      }
      this._lastShownAnchorId = null;
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
    localStorage.setItem(SIDEBAR_KEYS[section], '1');
  }

  collapseSection(section: 'panel' | 'operaciones' | 'admin'): void {
    localStorage.setItem(SIDEBAR_KEYS[section], '0');
  }

  private collapseAllSections(): void {
    Object.values(SIDEBAR_KEYS).forEach((key) => localStorage.setItem(key, '0'));
  }

  private setupStepHandlers(): void {
    this.stepShowSub?.unsubscribe();
    this.stepShowSub = this.tourService.stepShow$.subscribe((event: any) => {
      const step = event.step || event;
      const tourStep = this.filteredSteps.find((s) => s.anchorId === step?.anchorId);
      if (tourStep?.expandSection) {
        this.expandSection(tourStep.expandSection);
        // Cerrar otras secciones del sidebar al abrir una nueva
        if (tourStep.expandSection === 'admin') {
          this.collapseSection('panel');
          this.collapseSection('operaciones');
        } else if (tourStep.expandSection === 'operaciones') {
          this.collapseSection('panel');
          this.collapseSection('admin');
        } else if (tourStep.expandSection === 'panel') {
          this.collapseSection('operaciones');
          this.collapseSection('admin');
        }
      }
      if (step?.anchorId) {
        this.saveCurrentStep(step.anchorId);
        this._lastShownAnchorId = step.anchorId;
      }
      // Guardar progreso: índice del paso alcanzado
      if (this.filteredSteps.length > 0) {
        const idx = this.filteredSteps.findIndex(s => s.anchorId === step?.anchorId);
        if (idx >= 0) {
          this.saveProgress(idx + 1, this.filteredSteps.length);
        }
      }
    });
  }

  start(): void {
    // Finalizar tour anterior si existe para reinicializar limpiamente
    this.stepShowSub?.unsubscribe();
    this.stepShowSub = undefined;
    this.tourService.end();

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

      // Limpiar paso guardado ya que estamos empezando de cero
      this.clearCurrentStep();
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
    this.clearCurrentStep();
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
    // Marcar progreso al 100% al completar
    const total = this.filteredSteps.length || this.buildSteps().length;
    if (total > 0) {
      this.saveProgress(total, total);
    }
  }

  resetSeen(): void {
    const usuario = this.auth.usuarioActual;
    if (!usuario) return;
    localStorage.removeItem(`${TOUR_SEEN_KEY}_${usuario.id}`);
    this.clearCurrentStep();
    this.clearProgress();
  }

  // ─── Persistencia del paso actual durante recarga ───────

  private userStepKey(): string {
    const usuario = this.auth.usuarioActual;
    return `${TOUR_STEP_KEY}_${usuario?.id ?? 'guest'}`;
  }

  private saveCurrentStep(anchorId: string): void {
    localStorage.setItem(this.userStepKey(), anchorId);
  }

  private clearCurrentStep(): void {
    localStorage.removeItem(this.userStepKey());
  }

  private getSavedStep(): string | null {
    return localStorage.getItem(this.userStepKey());
  }

  /**
   * Reanuda el tour si el usuario lo tenía en curso antes de recargar.
   * Llamar después de que el usuario esté autenticado y el DOM esté listo.
   */
  resumeIfInProgress(): void {
    const savedAnchor = this.getSavedStep();
    if (!savedAnchor) return;
    // Si ya completó el tour, no reanudar
    if (this.hasSeen()) {
      this.clearCurrentStep();
      return;
    }

    this.resumeFromStep(savedAnchor);
  }

  private resumeFromStep(anchorId: string): void {
    this.stepShowSub?.unsubscribe();
    this.stepShowSub = undefined;
    // Usar bandera _resuming para que end$ no colapse las secciones del sidebar
    this._resuming = true;
    try { this.tourService.end(); } catch { /* tour no activo */ }
    this._resuming = false;

    this.filteredSteps = this.buildSteps();
    if (this.filteredSteps.length === 0) return;

    const targetIndex = this.filteredSteps.findIndex(s => s.anchorId === anchorId);
    if (targetIndex < 0) {
      this.clearCurrentStep();
      return;
    }

    // Expandir secciones ANTES de la navegación para que el sidebar
    // renderice con las secciones abiertas desde el inicio
    for (let i = 0; i <= targetIndex; i++) {
      const step = this.filteredSteps[i];
      if (step.expandSection) {
        this.expandSection(step.expandSection);
      }
    }

    const firstStep = this.filteredSteps[0];
    const firstRoute = firstStep?.route;
    const navigation$ = firstRoute
      ? this.router.navigateByUrl(firstRoute)
      : Promise.resolve(true);

    navigation$.then(() => {
      // Esperar un tick para que Angular renderice el sidebar con
      // las secciones expandidas antes de mostrar el tooltip del tour
      setTimeout(() => {
        this.tourService.initialize(this.filteredSteps, {
          showProgress: true,
          enableBackdrop: true,
          closeOnOutsideClick: false,
          nextBtnTitle: 'Siguiente',
          prevBtnTitle: 'Anterior',
          endBtnTitle: 'Finalizar',
        });

        this.setupStepHandlers();
        this.tourService.startAt(targetIndex);
      }, 50);
    });
  }

  get totalSteps(): number {
    return this.buildSteps().length;
  }

  // ─── Persistencia de progreso ───────

  private progressKey(): string {
    const usuario = this.auth.usuarioActual;
    return `${TOUR_PROGRESS_KEY}_${usuario?.id ?? 'guest'}`;
  }

  /** Guarda el progreso actual (paso alcanzado y total de pasos). */
  saveProgress(maxStepReached: number, totalSteps: number): void {
    const data = JSON.stringify({ maxStepReached, totalSteps });
    localStorage.setItem(this.progressKey(), data);
  }

  /** Retorna el progreso guardado o null si no hay. */
  getProgress(): { maxStepReached: number; totalSteps: number } | null {
    const data = localStorage.getItem(this.progressKey());
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  /** Limpia el progreso guardado. */
  clearProgress(): void {
    localStorage.removeItem(this.progressKey());
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
