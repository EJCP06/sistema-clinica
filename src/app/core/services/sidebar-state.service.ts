import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

/**
 * Servicio ligero que notifica al Sidebar cuando el TourGuideService
 * expande o colapsa una sección vía localStorage.
 * El sidebar no puede reaccionar directamente a cambios en localStorage
 * porque Angular no los detecta; este servicio emite un evento que el
 * sidebar escucha para ejecutar change detection.
 */
@Injectable({ providedIn: 'root' })
export class SidebarStateService {
  private readonly sectionsChanged$ = new Subject<string>();

  readonly sectionsChanged = this.sectionsChanged$.asObservable();

  notify(section: string): void {
    this.sectionsChanged$.next(section);
  }
}
