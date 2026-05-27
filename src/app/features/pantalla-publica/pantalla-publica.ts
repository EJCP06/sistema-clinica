import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription, interval } from 'rxjs';
import { LucideAngularModule, Activity, Clock, Users, ArrowRight } from 'lucide-angular';
import { ApiService } from '@core/services/api.service';

@Component({
  selector: 'app-pantalla-publica',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './pantalla-publica.html',
  styles: []
})
export class PantallaPublica implements OnInit, OnDestroy {
  private apiService = inject(ApiService);

  readonly Activity = Activity;
  readonly Clock = Clock;
  readonly Users = Users;
  readonly ArrowRight = ArrowRight;

  turnoActual: { turno: string; consultorio: string } | null = null;
  historicoLlamados: { turno: string; consultorio: string }[] = [];

  currentDate = new Date();
  private timerSub: Subscription | null = null;
  private cambiosSub: Subscription | null = null;

  ngOnInit() {
    this.timerSub = interval(1000).subscribe(() => this.currentDate = new Date());
    this.cambiosSub = this.apiService.cambios$.subscribe((data: unknown) => {
      const llamado = data as { turno: string; consultorio: string };
      if (llamado.turno && llamado.consultorio) {
        this.historicoLlamados = [llamado, ...this.historicoLlamados].slice(0, 5);
        this.turnoActual = llamado;
        this.reproducirAudio(llamado.turno, llamado.consultorio);
      }
    });
  }

  ngOnDestroy() {
    this.timerSub?.unsubscribe();
    this.cambiosSub?.unsubscribe();
  }

  reproducirAudio(turno: string, consultorio: string) {
    if (!('speechSynthesis' in window)) return;
    const texto = `Turno ${turno}. Diríjase al ${consultorio}.`;
    const utterance = new SpeechSynthesisUtterance(texto);
    utterance.lang = 'es-ES';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  }
}
