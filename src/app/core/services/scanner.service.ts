import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { Subject, Observable } from 'rxjs';

export interface ScannerData {
  cedula: string;
  primer_nombre: string;
  segundo_nombre: string;
  primer_apellido: string;
  segundo_apellido: string;
  fecha_nacimiento: string;
  raw: string;
}

@Injectable({ providedIn: 'root' })
export class ScannerService implements OnDestroy {
  private scanSubject = new Subject<ScannerData>();
  private buffer = '';
  private lastTime = 0;
  private burstCount = 0;
  private timer: any = null;
  private readonly BURST_THRESHOLD = 50;
  private readonly BURST_MIN_CHARS = 4;
  private readonly RESET_MS = 500;

  private handler = (e: KeyboardEvent) => this.onKey(e);

  constructor(private zone: NgZone) {
    this.zone.runOutsideAngular(() => {
      document.addEventListener('keydown', this.handler);
    });
  }

  get scan$(): Observable<ScannerData> {
    return this.scanSubject.asObservable();
  }

  private onKey(e: KeyboardEvent) {
    if (e.key === 'Tab') {
      e.preventDefault();
      this.buffer += '\t';
      this.burstCount++;
      this.lastTime = performance.now();
      this.resetTimer();
      return;
    }

    if (e.key === 'Enter') {
      if (this.burstCount >= this.BURST_MIN_CHARS) {
        e.preventDefault();
        const raw = this.buffer;
        this.buffer = '';
        this.burstCount = 0;
        this.parseAndEmit(raw);
      }
      return;
    }

    if (e.key.length === 1) {
      const now = performance.now();
      const delta = now - this.lastTime;

      if (delta < this.BURST_THRESHOLD || this.burstCount > 0) {
        this.buffer += e.key;
        this.burstCount++;
        this.lastTime = now;
        this.resetTimer();
      } else {
        this.buffer = '';
        this.burstCount = 0;
      }
    }
  }

  private resetTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.buffer = '';
      this.burstCount = 0;
    }, this.RESET_MS);
  }

  private parseAndEmit(raw: string) {
    const parts = raw.split('\t').map(s => s.trim()).filter(Boolean);
    const data: ScannerData = {
      cedula: parts[0] || '',
      primer_nombre: parts[3] || '',
      segundo_nombre: parts[4] || '',
      primer_apellido: parts[1] || '',
      segundo_apellido: parts[2] || '',
      fecha_nacimiento: this.normalizeDate(parts[5] || ''),
      raw,
    };
    this.zone.run(() => this.scanSubject.next(data));
  }

  private normalizeDate(dateStr: string): string {
    if (!dateStr) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    const m = dateStr.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
    if (m) return `${m[3]}-${m[1]}-${m[2]}`;
    const m2 = dateStr.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}`;
    return dateStr;
  }

  ngOnDestroy() {
    document.removeEventListener('keydown', this.handler);
    if (this.timer) clearTimeout(this.timer);
    this.scanSubject.complete();
  }
}
