import { Injectable } from '@angular/core';
import { ApiService } from '../../core/services/api.service';
import { AdmisionDTO } from '@core/models/dto.models';

@Injectable({ providedIn: 'root' })
export class ApsAdmissionListService {
  constructor(private api: ApiService) {}

  esDelServicio(nombreServicio: string | undefined | null, tipo: string): boolean {
    const nombre = (nombreServicio || '').toLowerCase();
    return tipo === 'laboratorio'
      ? nombre.includes('laboratorio')
      : nombre.includes('imágenes') || nombre.includes('imagenes');
  }

  esAseguradora(dto: { modalidad_pago?: string }): boolean {
    const modalidad = (dto.modalidad_pago || '').toString().trim().toLowerCase();
    return modalidad.includes('seguro') || modalidad.includes('asegur');
  }

  esConsulta(nombreServicio: string | undefined | null): boolean {
    const s = (nombreServicio || '').toLowerCase();
    return !s.includes('laboratorio') && !s.includes('imágenes') && !s.includes('imagenes') && nombreServicio !== 'SIN ASIGNAR';
  }

  cargarAdmisiones(api: ApiService): Promise<AdmisionDTO[]> {
    return new Promise((resolve) => {
      api.get<AdmisionDTO[]>('recepcion/ultimas-admisiones').subscribe({
        next: (data) => resolve(data || []),
        error: () => resolve([]),
      });
    });
  }

  filtrarParaAps(items: AdmisionDTO[]): AdmisionDTO[] {
    return items.filter(a => {
      if ([6, 9].includes(Number(a.id_estado_actual))) return false;
      const servicioLower = (a.nombre_servicio || '').toLowerCase();
      const esLab = servicioLower.includes('laboratorio');
      const esImg = servicioLower.includes('imágenes') || servicioLower.includes('imagenes');
      const esCon = !esLab && !esImg && a.nombre_servicio !== 'SIN ASIGNAR';
      const modalidad = (a.modalidad_pago || '').toLowerCase();
      const esSeg = modalidad === 'seguro';
      const esPart = modalidad === 'particular';
      if (esLab || esImg) { if ([3, 7].includes(Number(a.id_estado_actual))) return false; return esSeg; }
      if (esCon) return esSeg || esPart;
      return false;
    });
  }
}
