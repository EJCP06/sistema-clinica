import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, Bell, Volume2, Clock, Calendar, ArrowRight } from 'lucide-angular';
import { ApiService } from '../../core/services/api.service';
import { TurnoDTO } from '../../core/models/dto.models';
import { Subscription, interval } from 'rxjs';

@Component({
  selector: 'app-turnero',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './turnero.html'
})
export class TurneroComponent implements OnInit, OnDestroy {
  // Iconos
  readonly Bell = Bell;
  readonly Volume2 = Volume2;
  readonly Clock = Clock;
  readonly Calendar = Calendar;
  readonly ArrowRight = ArrowRight;

  // Datos
  turnosActivos: TurnoDTO[] = [];
  ultimoLlamado: TurnoDTO | null = null;
  fechaActual: Date = new Date();
  
  trackById = (index: number, item: TurnoDTO) => item?.id_atencion ?? item?.id ?? index;

  private timerSub: Subscription | null = null;
  private clockSub: Subscription | null = null;

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.cargarTurnos();
    
    // Refresco de datos cada 5 segundos para que sea "casi real"
    this.timerSub = interval(5000).subscribe(() => this.cargarTurnos());
    
    // Reloj en tiempo real
    this.clockSub = interval(1000).subscribe(() => this.fechaActual = new Date());
  }

  ngOnDestroy() {
    if (this.timerSub) this.timerSub.unsubscribe();
    if (this.clockSub) this.clockSub.unsubscribe();
  }

  cargarTurnos() {
    this.api.get<TurnoDTO[]>('recepcion/sala-espera').subscribe({
      next: (data) => {
        if (data.length > 0) {
          if (!this.ultimoLlamado || this.ultimoLlamado.id_atencion !== data[0].id_atencion) {
            this.notificarNuevoLlamado(data[0]);
          }
          this.ultimoLlamado = data[0];
          this.turnosActivos = data.slice(1, 6);
        }
      },
      error: () => console.error('Error sala espera:')
    });
  }

  notificarNuevoLlamado(turno: TurnoDTO) {
  }
}
