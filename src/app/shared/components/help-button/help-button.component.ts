import { Component, inject, HostListener, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, HelpCircle, X, Play, RotateCcw, CheckCircle } from 'lucide-angular';
import { TourGuideService } from '@core/services/tour.service';
import { TourService as NgxTourService } from 'ngx-ui-tour-md-menu';
import { AuthService } from '@core/services/auth.service';

@Component({
  selector: 'app-help-button',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './help-button.component.html',
})
/**
 * Botón flotante de ayuda que muestra un panel con información
 * sobre los módulos disponibles y permite iniciar el tour guiado.
 */
export class HelpButtonComponent implements OnInit, OnDestroy {
  private readonly tourGuide = inject(TourGuideService);
  private readonly ngxTour = inject(NgxTourService);
  private readonly auth = inject(AuthService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly HelpCircle = HelpCircle;
  readonly X = X;
  readonly Play = Play;
  readonly RotateCcw = RotateCcw;
  readonly CheckCircle = CheckCircle;

  private static readonly DISMISS_KEY = 'clinica_help_dismissed';

  panelOpen = false;
  tourProgress = 0;
  isTourRunning = false;
  tourCompleted = false;

  get dismissed(): boolean {
    return sessionStorage.getItem(HelpButtonComponent.DISMISS_KEY) === 'true';
  }

  dismiss(): void {
    sessionStorage.setItem(HelpButtonComponent.DISMISS_KEY, 'true');
    this.panelOpen = false;
  }

  get modules() {
    return this.tourGuide.availableModules;
  }

  get hasSeen(): boolean {
    return this.tourGuide.hasSeen();
  }

  ngOnInit(): void {
    let previousUserId: number | null = null;

    this.auth.usuario$.subscribe(usuario => {
      const currentId = usuario?.id ?? null;
      if (currentId !== previousUserId) {
        previousUserId = currentId;
        sessionStorage.removeItem(HelpButtonComponent.DISMISS_KEY);
      }
    });

    // Cargar progreso guardado
    this.loadSavedProgress();

    this.ngxTour.stepShow$.subscribe(() => this.updateProgress());
    this.ngxTour.end$.subscribe(() => this.onTourEnd());
    this.ngxTour.start$.subscribe(() => this.onTourStart());
  }

  ngOnDestroy(): void {}

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.panelOpen && !(event.target as HTMLElement).closest('.help-panel')) {
      this.panelOpen = false;
    }
  }

  togglePanel(): void {
    this.panelOpen = !this.panelOpen;
  }

  startTour(): void {
    this.panelOpen = false;
    setTimeout(() => this.tourGuide.start(), 200);
  }

  continueTour(): void {
    this.panelOpen = false;
    setTimeout(() => this.tourGuide.resumeIfInProgress(), 200);
  }

  resetTour(): void {
    this.tourGuide.resetSeen();
    this.tourCompleted = false;
    this.tourProgress = 0;
    this.isTourRunning = false;
  }

  private loadSavedProgress(): void {
    const saved = this.tourGuide.getProgress();
    if (saved && saved.totalSteps > 0) {
      this.tourProgress = Math.round((saved.maxStepReached / saved.totalSteps) * 100);
      this.tourCompleted = this.tourProgress === 100;
    } else {
      this.tourProgress = 0;
      this.tourCompleted = false;
    }
    this.cdr.detectChanges();
  }

  private updateProgress(): void {
    const currentStep = this.ngxTour.currentStep;
    const steps = this.ngxTour.steps;
    if (currentStep && steps && steps.length > 0) {
      const currentIndex = steps.findIndex(s => s === currentStep);
      if (currentIndex >= 0) {
        this.tourProgress = Math.round(((currentIndex + 1) / steps.length) * 100);
        this.tourGuide.saveProgress(currentIndex + 1, steps.length);
        this.cdr.detectChanges();
      }
    }
  }

  private onTourStart(): void {
    this.isTourRunning = true;
    this.tourCompleted = false;
    this.tourProgress = 0;
  }

  private onTourEnd(): void {
    this.isTourRunning = false;
    // Recargar progreso real desde localStorage (guardado por TourGuideService)
    this.loadSavedProgress();
    // Si el tour se completó al 100%, abrir el panel automáticamente
    if (this.tourCompleted) {
      this.panelOpen = true;
    }
    this.cdr.detectChanges();
  }
}
