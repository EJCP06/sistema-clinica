import { Injectable } from '@angular/core';
import { ApiService } from '../services/api.service';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class EspecialidadesService {
  constructor(private api: ApiService) {}

  getAllEspecialidades(): Observable<any[]> {
    return this.api.get('especialidades');
  }

  createEspecialidad(data: any): Observable<any> {
    return this.api.post('especialidades', data);
  }
}
