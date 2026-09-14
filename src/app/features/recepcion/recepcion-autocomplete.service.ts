import { Injectable } from '@angular/core';

/**
 * Estado de un dropdown de autocomplete genérico.
 * Reemplaza los 3 conjuntos idénticos de:
 *   showXxxDropdown, xxxFiltro, xxxIndex, onXxxInput, onXxxKeydown
 * (aseguradora, especialidad, médico).
 */
export interface AutocompleteState {
  showDropdown: boolean;
  filtro: string;
  index: number;
}

export interface AutocompleteItem {
  /** Propiedad a mostrar como texto */
  label: string;
  /** Identificador único */
  id: number | string;
}

/**
 * Servicio genérico para los dropdowns de autocomplete del formulario de recepción.
 * Cada dropdown (aseguradora, especialidad, médico) comparte la misma lógica de
 * filtrado por teclado, navegación con flechas y selección con Enter/Escape.
 *
 * ANTES: 3 bloques de ~60 líneas cada uno (onAseguradoraInput/Keydown,
 * onEspecialidadInput/Keydown, onMedicoInput/Keydown) = ~180 líneas.
 * DESPUÉS: 1 servicio de ~60 líneas reutilizado 3 veces.
 */
@Injectable({ providedIn: 'root' })
export class RecepcionAutocompleteService {

  /** Crea el estado inicial para un dropdown. */
  createState(): AutocompleteState {
    return { showDropdown: false, filtro: '', index: -1 };
  }

  /** Maneja el input de texto: actualiza el filtro y abre el dropdown. */
  onInput(state: AutocompleteState, value: string): void {
    state.filtro = value;
    state.showDropdown = true;
    state.index = -1;
  }

  /**
   * Maneja las teclas del dropdown: ↑↓ para navegar, Enter para seleccionar,
   * Escape para cerrar.
   * @returns 'select' si se seleccionó un item, null en caso contrario.
   */
  onKeydown(
    state: AutocompleteState,
    event: KeyboardEvent,
    items: AutocompleteItem[],
    onSelect: (item: AutocompleteItem) => void,
  ): 'select' | null {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        state.showDropdown = true;
        if (items.length) state.index = (state.index + 1) % items.length;
        return null;
      case 'ArrowUp':
        event.preventDefault();
        if (items.length) state.index = (state.index - 1 + items.length) % items.length;
        return null;
      case 'Enter':
        event.preventDefault();
        if (state.showDropdown && items[state.index]) {
          onSelect(items[state.index]);
          return 'select';
        }
        return null;
      case 'Escape':
        state.showDropdown = false;
        return null;
      default:
        return null;
    }
  }

  /** Selecciona un item: cierra dropdown, limpia índice, retorna el label para mostrar. */
  select(state: AutocompleteState, label: string): string {
    state.showDropdown = false;
    state.index = -1;
    return label;
  }

  /** Filtra items por una función de match personalizada. */
  filter<T>(items: T[], query: string, matcher: (item: T, q: string) => boolean): T[] {
    const q = (query || '').trim().toLowerCase();
    return items.filter(item => !q || matcher(item, q));
  }
}
