import { Injectable, inject, OnDestroy, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { TourService as NgxTourService, IStepOption } from 'ngx-ui-tour-md-menu';
import { AuthService } from './auth.service';
import { SidebarStateService } from './sidebar-state.service';
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
  private readonly sidebarState = inject(SidebarStateService);

  /** Flag estático: true mientras el tour está activo.
   *  El sidebar lo consulta para desactivar transiciones CSS del acordeón. */
  static tourActive = false;

  /** Sección del sidebar que está siendo destacada por el tour.
   *  Valores: 'panel' | 'operaciones' | 'admin' | null.
   *  El sidebar oscurece las secciones que no coinciden. */
  static activeTourSection: 'panel' | 'operaciones' | 'admin' | null = null;

  private filteredSteps: TourStep[] = [];
  private stepShowSub?: any;
  private stepHideSub?: any;
  private _resuming = false;
  private _lastShownAnchorId: string | null = null;
  private _navigating = false;

  /** Añade/quita la clase `tour-navigating` del body para que el CSS
   *  oculte el spotlight (backdrop) mientras la librería navega y carga
   *  la ruta del siguiente paso, evitando el flash de pantalla negra. */
  private setNavigating(on: boolean): void {
    if (this._navigating === on) return;
    this._navigating = on;
    if (on) document.body.classList.add('tour-navigating');
    else document.body.classList.remove('tour-navigating');
  }

  constructor() {
    this.tourService.end$.subscribe(() => {
      this.setNavigating(false);
      if (!this._resuming) {
        this.collapseAllSections();
        TourGuideService.tourActive = false;
        TourGuideService.activeTourSection = null;
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
    this.stepHideSub?.unsubscribe();
    this.setNavigating(false);
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
    this.sidebarState.notify(section);
  }

  collapseSection(section: 'panel' | 'operaciones' | 'admin'): void {
    localStorage.setItem(SIDEBAR_KEYS[section], '0');
    this.sidebarState.notify(section);
  }

  private collapseAllSections(): void {
    Object.values(SIDEBAR_KEYS).forEach((key) => localStorage.setItem(key, '0'));
    this.sidebarState.notify('all');
  }

  private setupStepHandlers(): void {
    this.stepShowSub?.unsubscribe();
    this.stepHideSub?.unsubscribe();

    // Al ocultarse un paso (flecha Siguiente/Anterior) la librería cierra
    // el spotlight antes de navegar: ocultamos el backdrop hasta que el
    // siguiente paso esté anclado y pueda reabrirse ya con su forma.
    this.stepHideSub = this.tourService.stepHide$.subscribe(() => this.setNavigating(true));

    this.stepShowSub = this.tourService.stepShow$.subscribe((event: any) => {
      // El paso siguiente ya está anclado y el spotlight reposicionado.
      this.setNavigating(false);
      const step = event.step || event;
      const tourStep = this.filteredSteps.find((s) => s.anchorId === step?.anchorId);
      const currentIdx = this.filteredSteps.findIndex(s => s.anchorId === step?.anchorId);

      // 1) Expandir sección del paso actual
      if (tourStep?.expandSection) {
        this.expandSection(tourStep.expandSection);
      }

      // 2) Pre-expandir sección del SIGUIENTE paso (excepto "Menú de Navegación")
      //    para que ya esté lista cuando el usuario haga clic en "Siguiente".
      //    EXCEPTIONS: No pre-expandir cuando la sección siguiente deba
      //    abrirse solo después de colapsar la actual (transiciones de
      //    panel → operaciones, operaciones → admin).
      const nextStep = currentIdx >= 0 && currentIdx < this.filteredSteps.length - 1
        ? this.filteredSteps[currentIdx + 1]
        : null;
      const isNavigationOverview = step?.anchorId === 'tour-sidebar-sections';

      // 3) Determinar qué sección está activa para el sidebar
      const anchorId = step?.anchorId || '';
      let currentSection: 'panel' | 'operaciones' | 'admin' | null = null;
      if (tourStep?.expandSection) {
        currentSection = tourStep.expandSection;
      } else if (anchorId.includes('panel') || anchorId.includes('dashboard')) {
        currentSection = 'panel';
      } else if (anchorId.includes('operaciones') || anchorId.includes('admision') || anchorId.includes('aps') || anchorId.includes('laboratorio') || anchorId.includes('imagenes') || anchorId.includes('atencion') || anchorId.includes('aseguradoras') || anchorId.includes('especialidades')) {
        currentSection = 'operaciones';
      } else if (anchorId.includes('admin') || anchorId.includes('personal') || anchorId.includes('roles') || anchorId.includes('permisos')) {
        currentSection = 'admin';
      }

      if (!isNavigationOverview && nextStep?.expandSection) {
        const isTransitionPanelToOperaciones = currentSection === 'panel' && nextStep.expandSection === 'operaciones';
        const isTransitionOperacionesToAdmin = currentSection === 'operaciones' && nextStep.expandSection === 'admin';
        if (!isTransitionPanelToOperaciones && !isTransitionOperacionesToAdmin) {
          this.expandSection(nextStep.expandSection);
        }
      }

      // 4) Cerrar secciones que no sean necesarias para el paso actual
      //    ni para el siguiente. Así la sección actual permanece abierta
      //    y el sidebar se prepara para el siguiente paso.
      const nextSection = (!isNavigationOverview && nextStep?.expandSection)
        ? nextStep.expandSection : null;

      if (currentSection !== 'panel' && nextSection !== 'panel') {
        this.collapseSection('panel');
      }
      if (currentSection !== 'operaciones' && nextSection !== 'operaciones') {
        this.collapseSection('operaciones');
      }
      if (currentSection !== 'admin' && nextSection !== 'admin') {
        this.collapseSection('admin');
      }

      // 4) Forzar detección de cambios de Angular para que el sidebar
      //    renderice con las secciones abiertas/cerradas.
      this.ngZone.run(() => {});

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
    this.stepHideSub?.unsubscribe();
    this.stepHideSub = undefined;
    this.setNavigating(false);
    this.tourService.end();

    this.filteredSteps = this.buildSteps();
    if (this.filteredSteps.length === 0) return;

    this.collapseAllSections();
    TourGuideService.tourActive = true;
    TourGuideService.activeTourSection = null;

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

  /**
   * Detecta la sección del sidebar a la que pertenece un paso del tour
   * basándose en su expandSection o en su anchorId.
   */
  private resolveSection(step: TourStep): 'panel' | 'operaciones' | 'admin' | null {
    if (step.expandSection) return step.expandSection;
    const id = step.anchorId || '';
    if (id.includes('panel') || id.includes('dashboard')) return 'panel';
    if (id.includes('operaciones') || id.includes('admision') || id.includes('aps')
      || id.includes('laboratorio') || id.includes('imagenes') || id.includes('atencion')
      || id.includes('aseguradoras') || id.includes('especialidades')) return 'operaciones';
    if (id.includes('admin') || id.includes('personal') || id.includes('roles')
      || id.includes('permisos')) return 'admin';
    return null;
  }

  /**
   * Detecta si el siguiente paso requiere una transición de sección
   * (panel→operaciones, operaciones→admin, etc.) y, si es así, cierra
   * la sección actual y abre la siguiente ANTES de que ngx-ui-tour
   * posicione el tooltip. Retorna true si se manejó la transición.
   */
  prepareSectionTransition(): boolean {
    try {
      const currentAnchorId = this.tourService.currentStep?.anchorId;
      const currentIdx = currentAnchorId
        ? this.filteredSteps.findIndex((s) => s.anchorId === currentAnchorId)
        : -1;
      if (currentIdx < 0) return false;

      const currentStep = this.filteredSteps[currentIdx];
      const nextStep = this.filteredSteps[currentIdx + 1];
      if (!currentStep || !nextStep) return false;

      const currentSection = this.resolveSection(currentStep);
      const nextSection = this.resolveSection(nextStep);
      if (!currentSection || !nextSection) return false;

      if (currentSection === nextSection) return false;

      this.collapseSection(currentSection);
      this.expandSection(nextSection);
      return true;
    } catch {
      return false;
    }
  }

  end(): void {
    TourGuideService.tourActive = false;
    TourGuideService.activeTourSection = null;
    this.setNavigating(false);
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
    this.stepHideSub?.unsubscribe();
    this.stepHideSub = undefined;
    this.setNavigating(false);
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

    // Colapsar TODAS las secciones primero para que no queden
    // expandidas de sesiones anteriores (ej. Usuarios).
    this.collapseAllSections();

    // Expandir SOLO la sección del paso destino (no las anteriores)
    // para evitar que Panel Control se abra y cierre al reanudar en Operaciones.
    const targetStep = this.filteredSteps[targetIndex];
    if (targetStep?.expandSection) {
      this.expandSection(targetStep.expandSection);
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
