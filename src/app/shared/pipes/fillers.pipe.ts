import { Pipe, PipeTransform } from '@angular/core';

/** Pipe que genera un array de relleno para completar visualmente las filas de una página. */
@Pipe({ name: 'fillers', standalone: true })
export class FillersPipe implements PipeTransform {
  transform<T>(items: T[] | null, page: number, pageSize: number): number[] {
    const totalItems = items ? items.length : 0;
    const start = (page - 1) * pageSize;
    const onPage = Math.min(pageSize, Math.max(0, totalItems - start));
    return Array(Math.max(0, pageSize - onPage)).fill(0);
  }
}
