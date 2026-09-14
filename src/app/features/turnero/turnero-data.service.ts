import { Injectable } from '@angular/core';
import { ApiService } from '../../core/services/api.service';
import { TurnoDTO } from '../../core/models/dto.models';

export interface SeccionConfig {
  id: number;
  titulo: string;
  filtro: {
    estados?: number[];
    servicios?: number[];
    responsable?: number[];
  };
}

export interface SeccionData {
  data: TurnoDTO[][];
  loading: boolean[];
}

/**
 * Servicio genérico de carga de datos para el turnero.
 * Reemplaza los 7 métodos casi idénticos (cargarAPS, cargarAPSEspera, cargarLab, etc.)
 * por uno solo parametrizable.
 */
@Injectable({ providedIn: 'root' })
export class TurneroDataService {
  constructor(private api: ApiService) {}

  /**
   * Carga datos para una sección del turnero.
   * @param secciones - Configuración de las sub-secciones (APS tiene 2, lab/img tienen 1)
   * @param sede - ID de la sede actual
   * @param estado - Referencia al objeto donde se almacenan los datos y el estado de carga
   */
  cargarSeccion(secciones: SeccionConfig[], sede: number | null, estado: SeccionData): void {
    for (let i = 0; i < secciones.length; i++) {
      const seccion = secciones[i];
      const params = new URLSearchParams();
      if (seccion.filtro.estados?.length) params.set('estados', seccion.filtro.estados.join(','));
      if (seccion.filtro.servicios?.length) params.set('servicios', seccion.filtro.servicios.join(','));
      if (seccion.filtro.responsable?.length) params.set('responsable', seccion.filtro.responsable.join(','));
      if (sede) params.set('sede', String(sede));

      this.api.get<TurnoDTO[]>(`turnero/pacientes?${params.toString()}`).subscribe({
        next: (data) => {
          estado.data[i] = data;
          if (estado.loading[i]) estado.loading[i] = false;
        },
        error: () => {
          if (!estado.data[i]) {
            estado.data[i] = [];
            estado.loading[i] = false;
          }
        },
      });
    }
  }
}
