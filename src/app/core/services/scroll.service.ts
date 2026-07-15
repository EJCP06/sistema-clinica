import { Injectable, inject } from '@angular/core';
import { Overlay } from '@angular/cdk/overlay';

/** Servicio que bloquea/desbloquea el scroll del fondo usando la estrategia de CDK Overlay. */
@Injectable({ providedIn: 'root' })
export class ScrollService {
  private overlay = inject(Overlay);
  private blockStrategy = this.overlay.scrollStrategies.block();

  block() {
    try { this.blockStrategy.enable(); } catch { /* noop */ }
  }

  unblock() {
    try { this.blockStrategy.disable(); } catch { /* noop */ }
  }
}
