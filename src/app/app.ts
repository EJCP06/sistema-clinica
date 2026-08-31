import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { ApiService } from '@core/services/api.service';
import { AuthService } from '@core/services/auth.service';
import { Capacitor } from '@capacitor/core';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
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
  private intervalRefrescador: ReturnType<typeof setInterval> | null = null;

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
