import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { createWorker } from 'tesseract.js';
import { ScannerData } from './scanner.service';

@Injectable({ providedIn: 'root' })
export class OcrService {
  private worker: Awaited<ReturnType<typeof createWorker>> | null = null;
  private workerPromise: Promise<void> | null = null;
  private _initializing = false;
  private _progress = 0;

  get initializing() { return this._initializing; }
  get progress() { return this._progress; }

  async initWorker(): Promise<void> {
    if (this.worker) return;
    if (this.workerPromise) return this.workerPromise;

    this._initializing = true;
    this.workerPromise = (async () => {
      const w = await createWorker('spa', undefined, {
        logger: (m: any) => {
          if (m.status === 'recognizing text') {
            this._progress = Math.round((m.progress || 0) * 100);
          }
        },
      });
      this.worker = w;
      this._initializing = false;
    })();
    return this.workerPromise;
  }

  recognize(file: File): Observable<ScannerData> {
    return new Observable(sub => {
      (async () => {
        try {
          await this.initWorker();
          if (!this.worker) throw new Error('Worker no disponible');

          this._progress = 0;

          const { data } = await this.worker.recognize(file);
          this._progress = 100;

          const result = this.parse(data.text);
          sub.next(result);
          sub.complete();
        } catch (err: any) {
          if (err?.message?.includes('Worker terminated')) {
            sub.error(new Error('Cancelado por el usuario'));
          } else {
            sub.error(err);
          }
        }
      })();
    });
  }

  cancel() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.workerPromise = null;
    this._initializing = false;
    this._progress = 0;
  }

  dispose() {
    this.cancel();
  }

  private parse(raw: string): ScannerData {
    const upper = raw.toUpperCase();
    const lines = upper.split('\n').map(l => l.trim()).filter(Boolean);
    const fullText = lines.join(' ');

    const cedula = this.extractCedula(fullText);
    const apellidos = this.extractField(fullText, /APELLIDOS?\s*:?\s*([A-Z\s]+?)(?=\s+(?:NOMBRES?|FECHA|ESTADO|SEXO|LUGAR|FECHA NACIMIENTO|EXPEDICION|VENCIMIENTO|$))/);
    const nombres = this.extractField(fullText, /NOMBRES?\s*:?\s*([A-Z\s]+?)(?=\s+(?:FECHA|ESTADO|SEXO|LUGAR|FECHA NACIMIENTO|APELLIDOS?|$))/);
    const fechaNacimiento = this.extractField(upper, /FECHA\s*DE\s*NACIMIENTO\s*:?\s*(\d{1,2})\s*[\/\-]\s*(\d{1,2})\s*[\/\-]\s*(\d{2,4})/);

    const [primerApellido, ...restoApellido] = (apellidos || '').split(/\s+/);
    const [primerNombre, ...restoNombre] = (nombres || '').split(/\s+/);

    let fechaFormateada = '';
    if (fechaNacimiento) {
      const m = fechaNacimiento.match(/(\d{1,2})\s*[\/\-]\s*(\d{1,2})\s*[\/\-]\s*(\d{2,4})/);
      if (m) {
        const d = m[1].padStart(2, '0');
        const mo = m[2].padStart(2, '0');
        let y = m[3];
        if (y.length === 2) y = '20' + y;
        fechaFormateada = `${y}-${mo}-${d}`;
      }
    }

    return {
      cedula,
      primer_nombre: (primerNombre || '').replace(/[^A-Z]/g, ''),
      segundo_nombre: (restoNombre.join(' ') || '').replace(/[^A-Z\s]/g, '').trim(),
      primer_apellido: (primerApellido || '').replace(/[^A-Z]/g, ''),
      segundo_apellido: (restoApellido.join(' ') || '').replace(/[^A-Z\s]/g, '').trim(),
      fecha_nacimiento: fechaFormateada,
      raw,
    };
  }

  private extractCedula(text: string): string {
    const patterns = [
      /(?:V|E)\s*\.?\s*(\d{1,3})[\.\s]*(\d{1,3})[\.\s]*(\d{1,4})\b/i,
      /CEDULA[^A-Z]*DE[^A-Z]*IDENTIDAD[^A-Z]*?(?:V|E)?\s*\.?\s*(\d{1,3})[\.\s]*(\d{1,3})[\.\s]*(\d{1,4})\b/i,
      /(\d{1,3})[\.\s]*(\d{1,3})[\.\s]*(\d{1,4})\b/,
    ];
    for (const pattern of patterns) {
      const m = text.match(pattern);
      if (m) {
        const nums = m.slice(-3).join('');
        if (nums.length >= 6 && nums.length <= 8) return nums;
      }
    }
    return '';
  }

  private extractField(text: string, regex: RegExp): string {
    const m = text.match(regex);
    if (!m) return '';
    return m[1]
      .replace(/[^A-Z\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
