import { TurnoDTO } from '../../core/models/dto.models';
import { ApiService } from '../../core/services/api.service';
import { APSSeccion } from './turnero.interfaces';

/**
 * Helper puro para cargar datos de turnos por sección.
 * Elimina la duplicación de cargarAPS/cargarLab/cargarImg/etc.
 */
export function cargarSeccion(
  api: ApiService,
  secciones: APSSeccion[],
  sede: number | null,
): { data: TurnoDTO[][]; loading: boolean[] } {
  const data: TurnoDTO[][] = [];
  const loading: boolean[] = [];

  for (let i = 0; i < secciones.length; i++) {
    const seccion = secciones[i];
    const params = new URLSearchParams();
    if (seccion.filtro.estados?.length) params.set('estados', seccion.filtro.estados.join(','));
    if (seccion.filtro.servicios?.length) params.set('servicios', seccion.filtro.servicios.join(','));
    if (seccion.filtro.responsable?.length) params.set('responsable', seccion.filtro.responsable.join(','));
    if (sede) params.set('sede', String(sede));

    loading[i] = true;

    api.get<TurnoDTO[]>(`turnero/pacientes?${params.toString()}`).subscribe({
      next: (turnos) => {
        data[i] = turnos;
        loading[i] = false;
      },
      error: () => {
        if (!data[i]) {
          data[i] = [];
          loading[i] = false;
        }
      },
    });
  }

  return { data, loading };
}
