import { Injectable } from '@angular/core';

export interface AutocompleteState {
  filtro: string;
  index: number;
  showDropdown: boolean;
}

@Injectable({ providedIn: 'root' })
export class ColaAutocompleteService {
  create(): AutocompleteState {
    return { filtro: '', index: -1, showDropdown: false };
  }

  onInput(state: AutocompleteState, event: Event): void {
    state.filtro = (event.target as HTMLInputElement).value;
    state.showDropdown = true;
    state.index = -1;
  }

  onKeydown(state: AutocompleteState, event: KeyboardEvent, list: any[]): void {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      state.showDropdown = true;
      if (list.length) state.index = (state.index + 1) % list.length;
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (list.length) state.index = (state.index - 1 + list.length) % list.length;
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (state.showDropdown && list[state.index]) {
        state.showDropdown = false;
      }
    } else if (event.key === 'Escape') {
      state.showDropdown = false;
    }
  }

  select(state: AutocompleteState, label: string): void {
    state.filtro = label;
    state.index = -1;
    state.showDropdown = false;
  }

  filterItems(items: any[], query: string, key: string): any[] {
    const q = (query || '').trim().toLowerCase();
    return items.filter((item: any) => !q || (item[key] || '').toLowerCase().includes(q));
  }

  filterByComposite(items: any[], query: string, keyA: string, keyB: string): any[] {
    const q = (query || '').trim().toLowerCase();
    return items.filter((item: any) => {
      const full = ((item[keyA] || '') + ' ' + (item[keyB] || '')).toLowerCase();
      return !q || full.includes(q);
    });
  }
}
