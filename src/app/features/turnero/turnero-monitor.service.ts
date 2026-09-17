import { Injectable, OnDestroy } from '@angular/core';
import { Subject, Subscription, interval } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { TurneroVozService } from './turnero-voz.service';

/**
 * Servicio de monitoreo del turnero: gestiona el polling del último llamado,
 * la sincronización de reloj con el servidor y los intervalos de refresco.
 * El componente solo se suscribe a los Observables y actualiza el HTML.
 */
@Injectable({ providedIn: 'root' })
export class TurneroMonitorService implements OnDestroy {
  // -- Observables para el componente --
  private horaActualSubject = new Subject<Date>();
  horaActual$ = this.horaActualSubject.asObservable();

  private cargarSalaSubject = new Subject<void>();
  cargarSala$ = this.cargarSalaSubject.asObservable();

  // -- Sede actual --
  private sede: number | null = null;

  // -- Polling state --
  private verificandoUltimoLlamado = false;
  private verificarTimeout: any = null;
  private verificarFetchSub: Subscription | null = null;

  // -- Subscriptions --
  private verificarSub: Subscription | null = null;
  private timerSub: Subscription | null = null;
  private clockSub: Subscription | null = null;

  constructor(
    private api: ApiService,
    private voz: TurneroVozService,
  ) {}

  ngOnDestroy(): void {
    this.detener();
  }

  /**
   * Actualiza la sede y dispara la verificación inicial.
   */
  setSede(sede: number | null): void {
    this.sede = sede;
    this.verificarUltimoLlamado();
  }

  /**
   * Inicia todos los intervalos: polling (2s), refresco de datos (5s), reloj (1s).
   */
  iniciar(): void {
    // Polling del último llamado cada 2s
    this.verificarSub = interval(2000).subscribe(() => {
      this.verificarUltimoLlamado();
    });

    // Refresco de datos de sala cada 5s
    this.timerSub = interval(5000).subscribe(() => {
      this.cargarSalaSubject.next();
    });

    // Reloj cada 1s
    this.clockSub = interval(1000).subscribe(() => {
      this.horaActualSubject.next(new Date());
    });
  }

  /**
   * Detiene todos los intervalos y limpia timeouts/subscriptions.
   */
  detener(): void {
    this.verificarSub?.unsubscribe();
    this.timerSub?.unsubscribe();
    this.clockSub?.unsubscribe();
    if (this.verificarTimeout) {
      clearTimeout(this.verificarTimeout);
      this.verificarTimeout = null;
    }
    this.verificarFetchSub?.unsubscribe();
  }

  /**
   * Verifica periódicamente si hay un llamado nuevo (respaldo del socket).
   * Si detecta uno, lo procesa directamente vía TurneroVozService.
   */
  private verificarUltimoLlamado(): void {
    if (!this.sede || this.verificandoUltimoLlamado) return;
    this.verificandoUltimoLlamado = true;
    const terminar = () => { this.verificandoUltimoLlamado = false; };

    this.verificarTimeout = setTimeout(() => {
      this.verificarFetchSub = this.api.get<any>(`turnero/ultimo-llamado?sede=${this.sede}`).subscribe({
        next: (data) => {
          if (!data || !data.id_atencion || !data.paciente || !data.consultorio) {
            terminar();
            return;
          }

          this.voz.actualizarDeltaReloj(data.server_now);
          if (data.inicio_ms) {
            this.voz.inicioMsActual = data.inicio_ms;
          }

          // Defensa: no anunciar llamados antiguos (>10 min)
          const referenciaHora = data.hora_llamado_epoch || (data.hora_llamado ? new Date(data.hora_llamado).getTime() : null);
          if (referenciaHora) {
            const antiguedadMin = (Date.now() - (referenciaHora - this.voz.deltaRelojMs)) / 60000;
            if (antiguedadMin > 10) {
              if (this.voz.anunciosActivos.has(data.id_atencion)) {
                this.voz.detenerRepeticion(data.id_atencion);
              }
              terminar();
              return;
            }
          }

          // Anti voz doble
          const horaDeEsteLlamado = data.inicio_ms || data.hora_llamado_epoch ||
            (data.hora_llamado ? new Date(data.hora_llamado).getTime() : 0) || 0;
          if (data.id_atencion === this.voz.ultimoLlamadoProcesadoId) {
            if (!horaDeEsteLlamado || horaDeEsteLlamado <= this.voz.ultimoLlamadoProcesadoHora) {
              terminar();
              return;
            }
          } else if (horaDeEsteLlamado && this.voz.ultimoLlamadoProcesadoHora >= horaDeEsteLlamado) {
            terminar();
            return;
          }
          this.voz.ultimoLlamadoProcesadoId = data.id_atencion;
          this.voz.ultimoLlamadoProcesadoHora = horaDeEsteLlamado;

          if (this.voz.anunciosActivos.has(data.id_atencion)) {
            terminar();
            return;
          }

          // Reanudación tras recarga
          if (this.voz.ultimoIdAnunciado === data.id_atencion && this.voz.ultimaVezAnunciado > 0 && this.voz.inicioMsActual) {
            const esMismoLlamado = this.voz.ultimoAnuncioInicioMs !== null && Number.isFinite(this.voz.ultimoAnuncioInicioMs) &&
              !!data.inicio_ms && Math.abs(data.inicio_ms - this.voz.ultimoAnuncioInicioMs) < 5000;
            const anclaLocal = this.voz.inicioMsActual - this.voz.deltaRelojMs;
            const elapsed = Date.now() - anclaLocal;
            if (esMismoLlamado && elapsed >= -3000 && elapsed < 120000) {
              data.inicio_ms = this.voz.ultimoAnuncioInicioMs!;
              data.inicio_inmediato = false;
              this.voz.procesarLlamado(data);
              terminar();
              return;
            }
          }

          // Nuevo llamado desde polling
          this.voz.procesarLlamado(data);
          terminar();
        },
        error: () => terminar(),
      });
    }, 500);
  }
}
