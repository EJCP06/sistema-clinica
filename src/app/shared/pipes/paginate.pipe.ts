import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'paginate', standalone: true })
export class PaginatePipe implements PipeTransform {
  transform<T>(items: T[] | null, page: number, pageSize: number): T[] {
    if (!items || items.length === 0) return [];
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }
}
