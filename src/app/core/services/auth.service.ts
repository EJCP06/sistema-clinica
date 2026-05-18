import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { Usuario, Rol } from '@core/models/usuario.model';

import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { environment } from '@env/environment';

const RUTA_POR_ROL: Record<Rol, string> = {
  admin: '/admin',
  recepcionista: '/recepcion',
  medico: '/atencion',
  aps: '/aps',
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private STORAGE_KEY = 'clinica_usuario';
  private TOKEN_KEY = 'clinica_token';
  private usuarioSubject = new BehaviorSubject<Usuario | null>(this.cargarSesion());

  usuario$ = this.usuarioSubject.asObservable();

  constructor(private router: Router, private http: HttpClient) {}

  get usuarioActual(): Usuario | null {
    return this.usuarioSubject.value;
  }

  getToken(): string | null {
    return sessionStorage.getItem(this.TOKEN_KEY);
  }

  login(username: string, password: string): Observable<any> {
    // Si es pantalla pública, hacemos bypass o llamamos a un endpoint específico
    if (username === 'tv') {
      const mockTvUsuario: Usuario = { id: 0, username: 'tv', nombre: 'Pantalla Pública', rol: 'recepcionista', password: '' };
      this.usuarioSubject.next(mockTvUsuario);
      this.router.navigate(['/tv']);
      return new BehaviorSubject(true);
    }

    return this.http.post<{mensaje: string, token: string, usuario: any}>(`${environment.apiUrl}/auth/login`, { username, password })
      .pipe(
        tap(response => {
          // Normalizar: el backend devuelve username, aseguramos que nombre esté presente
          const usuario: Usuario = {
            ...response.usuario,
            nombre: response.usuario.nombre || response.usuario.username
          };
          sessionStorage.setItem(this.TOKEN_KEY, response.token);
          sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(usuario));
          this.usuarioSubject.next(usuario);
          this.router.navigate([RUTA_POR_ROL[usuario.rol]]);
        }),
        catchError(err => throwError(() => new Error(err.error?.mensaje || 'Error en login')))
      );
  }

  logout() {
    sessionStorage.removeItem(this.STORAGE_KEY);
    sessionStorage.removeItem(this.TOKEN_KEY);
    this.usuarioSubject.next(null);
    this.router.navigate(['/login']);
  }

  estaAutenticado(): boolean {
    return this.usuarioSubject.value !== null;
  }

  tieneRol(roles: Rol[]): boolean {
    const usuario = this.usuarioSubject.value;
    if (!usuario) return false;
    return roles.includes(usuario.rol);
  }

  private cargarSesion(): Usuario | null {
    try {
      const data = sessionStorage.getItem(this.STORAGE_KEY);
      if (!data) return null;
      
      const usuario: Usuario = JSON.parse(data);
      
      // Validación crítica: Si el usuario no tiene id_sede (sesión vieja), forzar logout
      if (usuario.rol !== 'recepcionista' && usuario.username !== 'tv' && usuario.id !== 0 && !usuario.id_sede) {
        console.warn('Sesión antigua detectada (sin id_sede). Forzando logout...');
        setTimeout(() => this.logout(), 0);
        return null;
      }
      
      return usuario;
    } catch {
      return null;
    }
  }
}
