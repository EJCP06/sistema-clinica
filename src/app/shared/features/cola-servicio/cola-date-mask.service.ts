import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ColaDateMaskService {
  fechaADisplay(fecha: string): string {
    if (!fecha || fecha.length < 10) return fecha || '';
    const partes = fecha.substring(0, 10).split('-');
    if (partes.length !== 3) return fecha;
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }

  fechaABackend(fecha: string): string | null {
    if (!fecha || !/^\d{2}\/\d{2}\/\d{4}$/.test(fecha)) return null;
    const partes = fecha.split('/');
    return `${partes[2]}-${partes[1]}-${partes[0]}`;
  }

  aplicarCambioFecha(
    displayAnterior: string,
    nuevoValor: string,
    cursorPos: number,
  ): { valor: string; cursor: number } {
    const viejo = this.obtenerSlots(displayAnterior);
    const nuevoDigitos = nuevoValor.replace(/\D/g, '').substring(0, 8);
    const viejoDigitos = viejo.filter((ch) => /\d/.test(ch)).join('');

    if (nuevoDigitos.length === 0) {
      return { valor: '', cursor: 0 };
    }

    if (nuevoDigitos.length < viejoDigitos.length) {
      const cuantos = viejoDigitos.length - nuevoDigitos.length;
      const cursorDigitos = nuevoValor.substring(0, cursorPos).replace(/\D/g, '').length;
      const slots = viejo.slice();
      for (let i = cursorDigitos; i < cursorDigitos + cuantos && i < 8; i++) slots[i] = ' ';
      return { valor: this.reconstruir(slots), cursor: this.posicionDeSlot(cursorDigitos) };
    }

    if (nuevoDigitos.length === viejoDigitos.length) {
      const slots = viejo.map((ch, i) =>
        /\d/.test(ch) ? nuevoDigitos[this.runIndex(i, viejo)] : ch,
      );
      return { valor: this.reconstruir(slots), cursor: Math.min(cursorPos, 10) };
    }

    const added = nuevoDigitos.length - viejoDigitos.length;
    const cursorDigitos = nuevoValor.substring(0, cursorPos).replace(/\D/g, '').length;
    const insertSlot = Math.max(0, cursorDigitos - added);
    const slots = viejo.slice();
    let pos = insertSlot;
    let ultimoRellenado = -1;
    for (let k = insertSlot; k < insertSlot + added && k < 8; k++) {
      while (pos < 8 && /\d/.test(slots[pos])) pos++;
      if (pos >= 8) break;
      slots[pos] = nuevoDigitos[k];
      ultimoRellenado = pos;
      pos++;
    }
    const cursor =
      ultimoRellenado >= 0
        ? this.posicionDeSlot(ultimoRellenado) + 1
        : this.posicionDeSlot(insertSlot);
    return { valor: this.reconstruir(slots), cursor };
  }

  private obtenerSlots(display: string): string[] {
    if (!display) return Array(8).fill(' ');
    return [0, 1, 3, 4, 6, 7, 8, 9].map((i) => display[i] ?? ' ');
  }

  private reconstruir(slots: string[]): string {
    return (
      slots[0] +
      slots[1] +
      '/' +
      slots[2] +
      slots[3] +
      '/' +
      slots[4] +
      slots[5] +
      slots[6] +
      slots[7]
    );
  }

  private posicionDeSlot(slotIndex: number): number {
    const posiciones = [0, 1, 3, 4, 6, 7, 8, 9];
    return posiciones[slotIndex] ?? 10;
  }

  private runIndex(slotIndex: number, viejo: string[]): number {
    let count = 0;
    for (let i = 0; i < slotIndex; i++) {
      if (/\d/.test(viejo[i])) count++;
    }
    return count;
  }
}
