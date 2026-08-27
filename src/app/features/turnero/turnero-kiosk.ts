import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { TurneroComponent } from './turnero';

@Component({
  selector: 'app-turnero-kiosk',
  standalone: true,
  imports: [CommonModule, TurneroComponent],
  template: `
    <!-- Modo kiosco: carga directamente el turnero sin login -->
    <app-turnero></app-turnero>
  `
})
/**
 * Modo kiosco para Android TV.
 * Carga directamente el turnero con la sede configurada,
 * sin necesidad de login ni selector de sede.
 */
export class TurneroKiosk implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  ngOnInit() {
    // Obtener sede de query params o usar default
    const sedeParam = this.route.snapshot.queryParamMap.get('sede');
    const sede = sedeParam ? Number(sedeParam) : 1; // Default: Plaza Sucre
    
    // Guardar en sessionStorage para que el turnero la use
    sessionStorage.setItem('turnero_sede', String(sede));
    
    // Desbloquear audio (el kiosco asume interacción previa)
    sessionStorage.setItem('turnero_audio_unlocked', 'true');
    
    // Si no hay sede, mostrar selector
    if (!sede || isNaN(sede)) {
      this.router.navigate(['/turnero']);
    }
  }
}
