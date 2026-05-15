import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, Bell, Volume2, Clock, Calendar, ArrowRight } from 'lucide-angular';
import { ApiService } from '../../core/services/api.service';
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
  turnosActivos: any[] = [];
  ultimoLlamado: any = null;
  fechaActual: Date = new Date();
  
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
    this.api.get('recepcion/sala-espera').subscribe({
      next: (data: any) => {
        if (data.length > 0) {
          // Si el ID del primero ha cambiado, significa que hay un nuevo llamado
          if (!this.ultimoLlamado || this.ultimoLlamado.id_atencion !== data[0].id_atencion) {
            this.notificarNuevoLlamado(data[0]);
          }
          this.ultimoLlamado = data[0];
          this.turnosActivos = data.slice(1, 6); // Los siguientes 5
        }
      },
      error: (err) => console.error('Error sala espera:', err)
    });
  }

  notificarNuevoLlamado(turno: any) {
    console.log('¡LLAMANDO A:', turno.nombre);
    // Aquí podrías reproducir un sonido: new Audio('assets/sound.mp3').play();
  }
}
