import { Injectable, OnDestroy } from '@angular/core';
import { interval, timer, Subscription } from 'rxjs';
import { ApiService } from '@core/services/api.service';

export interface CountdownCallbacks {
  onExpire: (idAtencion: number) => void;
  onTick: (idAtencion: number, remaining: number) => void;
}

@Injectable({ providedIn: 'root' })
export class ColaCountdownService implements OnDestroy {
  readonly COUNTDOWN_TOTAL = 60;
  readonly VOZ_INTERVALO = 10000;

  private countdowns = new Map<number, number>();
  private countdownSubs = new Map<number, Subscription>();
  private voiceSubs = new Map<number, Subscription>();
  private countdownStarts = new Map<number, number>();
  private admisionCountdown = new Map<number, any>();
  private _tick = 0;

  get tick(): number {
    return this._tick;
  }

  constructor(private api: ApiService) {}

  getCountdown(idAtencion: number): number {
    void this._tick;
    return this.countdowns.get(idAtencion) ?? 0;
  }

  startCountdown(admision: any, tipo: string, callbacks?: CountdownCallbacks, forceSeconds?: number): void {
    const id = Number(admision.id_atencion);
    if (this.countdownSubs.has(id)) return;

    const nowMs = Date.now();
    const total = forceSeconds ?? this.COUNTDOWN_TOTAL;
    let offsetSec = 0;
    if (!forceSeconds && admision.hora_llamado) {
      offsetSec = Math.floor((nowMs - new Date(admision.hora_llamado).getTime()) / 1000);
      offsetSec = Math.min(offsetSec, total);
    }
    const startMs = nowMs - offsetSec * 1000;
    this.countdownStarts.set(id, startMs);
    this.countdowns.set(id, total - offsetSec);
    this.admisionCountdown.set(id, admision);

    const sub = interval(1000).subscribe(() => {
      const elapsed = Math.floor((Date.now() - this.countdownStarts.get(id)!) / 1000);
      const remaining = Math.max(0, total - elapsed);
      this.countdowns.set(id, remaining);
      this._tick = Date.now();
      callbacks?.onTick(id, remaining);
      if (remaining <= 0) {
        const adm = this.admisionCountdown.get(id);
        this.stopCountdown(id);
        if (adm) {
          this.api.put(`recepcion/atencion/${id}/marcar-ausente-real`, {}).subscribe({
            next: () => callbacks?.onExpire(id),
            error: () => {},
          });
        }
      }
    });
    this.countdownSubs.set(id, sub);

    const voiceSub = timer(this.VOZ_INTERVALO - 2000, this.VOZ_INTERVALO).subscribe(() => {
      this.api.post(`recepcion/atencion/${id}/llamar-${tipo}-se`, {}).subscribe({
        next: () => {},
        error: () => {},
      });
    });
    this.voiceSubs.set(id, voiceSub);
  }

  stopCountdown(idAtencion: number): void {
    const s1 = this.countdownSubs.get(idAtencion);
    if (s1) { s1.unsubscribe(); this.countdownSubs.delete(idAtencion); }
    const s2 = this.voiceSubs.get(idAtencion);
    if (s2) { s2.unsubscribe(); this.voiceSubs.delete(idAtencion); }
    this.countdowns.delete(idAtencion);
    this.countdownStarts.delete(idAtencion);
    this.admisionCountdown.delete(idAtencion);
    this._tick = Date.now();
  }

  stopAllCountdowns(): void {
    for (const id of this.countdownSubs.keys()) this.stopCountdown(id);
  }

  ngOnDestroy(): void {
    this.stopAllCountdowns();
  }
}
