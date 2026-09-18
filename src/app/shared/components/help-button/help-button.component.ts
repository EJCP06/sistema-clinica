import { Component, inject, HostListener, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, HelpCircle, X, Play, RotateCcw, CheckCircle } from 'lucide-angular';
import { TourGuideService } from '@core/services/tour.service';
import { TourService as NgxTourService } from 'ngx-ui-tour-md-menu';

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

  readonly HelpCircle = HelpCircle;
  readonly X = X;
  readonly Play = Play;
  readonly RotateCcw = RotateCcw;
  readonly CheckCircle = CheckCircle;

  panelOpen = false;
  tourProgress = 0;
  isTourRunning = false;
  tourCompleted = false;

  get modules() {
    return this.tourGuide.availableModules;
  }

  get hasSeen(): boolean {
    return this.tourGuide.hasSeen();
  }

  ngOnInit(): void {
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

  resetTour(): void {
    this.tourGuide.resetSeen();
    this.tourCompleted = false;
    this.tourProgress = 0;
    this.isTourRunning = false;
  }

  private updateProgress(): void {
    const currentStep = this.ngxTour.currentStep;
    const steps = this.ngxTour.steps;
    if (currentStep && steps && steps.length > 0) {
      const currentIndex = steps.findIndex(s => s === currentStep);
      if (currentIndex >= 0) {
        this.tourProgress = Math.round(((currentIndex + 1) / steps.length) * 100);
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
    this.tourCompleted = true;
    this.tourProgress = 100;
  }
}
