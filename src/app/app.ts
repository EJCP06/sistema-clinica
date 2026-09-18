import { Component, inject, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { ApiService } from '@core/services/api.service';
import { AuthService } from '@core/services/auth.service';
import { TourGuideService } from '@core/services/tour.service';
import { Capacitor } from '@capacitor/core';
import { HelpButtonComponent } from '@shared/components/help-button/help-button.component';
import { TourMatMenu, TourService as NgxTourService } from 'ngx-ui-tour-md-menu';
import { MatMenuModule } from '@angular/material/menu';

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet, HelpButtonComponent, ...TourMatMenu, MatMenuModule],
  templateUrl: './app.html',
})
/**
 * Componente raíz de la aplicación (bootstrap en src/main.ts).
 *
 * Responsabilidades:
 * 1. Escuchar los eventos en tiempo real de `ApiService.cambios$` y refrescar
 *    los permisos del usuario cuando el administrador los modifica.
 * 2. Al iniciar, verificar la sesión guardada y renovar el token si es un día
 *    nuevo o si está por expirar (AuthService).
 * 3. Mantener un refresco periódico del token cada 5 minutos mientras haya sesión.
 * 4. En APK nativa (Capacitor), ir directo al turnero sin login.
 */
export class App implements OnInit, OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly tourService = inject(NgxTourService);
  private readonly tourGuide = inject(TourGuideService);
  private intervalRefrescador: ReturnType<typeof setInterval> | null = null;

  tourSectionOpen: number | null = null;

  tourNext(): void {
    this.tourGuide.expandNextSection();
    this.tourSectionOpen = null;
    this.tourService.next();
  }
  tourPrev(): void {
    this.tourSectionOpen = null;
    this.tourService.prev();
  }
  toggleTourSection(index: number): void {
    this.tourSectionOpen = this.tourSectionOpen === index ? null : index;
  }
  tourEnd(): void {
    this.tourSectionOpen = null;
    this.tourService.end();
  }

  ngOnInit() {
    // En APK nativa, ir directo al turnero (sin login)
    if (Capacitor.isNativePlatform()) {
      this.router.navigate(['/turnero']);
      return;
    }

    this.api.cambios$.subscribe(data => {
      if (data.tipo === 'permisos') {
        this.auth.refrescarPermisos().subscribe();
      }
    });

    if (this.auth.getToken()) {
      this.auth.verifySession().subscribe();
      this.auth.refreshTokenSiEsNuevoDia();
    }

    this.intervalRefrescador = setInterval(() => {
      if (this.auth.getToken()) {
        this.auth.refreshTokenSiEsNuevoDia();
        this.auth.refreshTokenSiProximoAVencer();
      }
    }, 5 * 60 * 1000);
  }

  ngOnDestroy() {
    if (this.intervalRefrescador) {
      clearInterval(this.intervalRefrescador);
    }
  }
}
