import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription, interval } from 'rxjs';
import { LucideAngularModule, Activity, Clock, Users, ArrowRight } from 'lucide-angular';
import { io, Socket } from 'socket.io-client';
import { environment } from '@env/environment';

@Component({
  selector: 'app-pantalla-publica',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './pantalla-publica.html',
  styles: []
})
export class PantallaPublica implements OnInit, OnDestroy {
  readonly Activity = Activity;
  readonly Clock = Clock;
  readonly Users = Users;
  readonly ArrowRight = ArrowRight;

  turnoActual: { turno: string; consultorio: string } | null = null;
  historicoLlamados: { turno: string; consultorio: string }[] = [];

  currentDate = new Date();
  private timerSub: Subscription | null = null;
  private socket: Socket | null = null;

  ngOnInit() {
    this.timerSub = interval(1000).subscribe(() => this.currentDate = new Date());
    this.conectarSocket();
  }

  conectarSocket() {
    const socketUrl = environment.socketUrl || 'http://localhost:3000';
    this.socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    this.socket.on('connect', () => console.log('🔌 Pantalla conectada'));

    this.socket.on('nuevo-llamado', (data: { turno: string; consultorio: string }) => {
      this.historicoLlamados = [data, ...this.historicoLlamados].slice(0, 5);
      this.turnoActual = data;
      this.reproducirAudio(data.turno, data.consultorio);
    });

    this.socket.on('disconnect', () => console.log('🔴 Pantalla desconectada'));
  }

  ngOnDestroy() {
    this.timerSub?.unsubscribe();
    this.socket?.disconnect();
    this.socket = null;
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
