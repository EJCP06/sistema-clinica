import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { Usuario, Rol } from '@core/models/usuario.model';

import { HttpClient } from '@angular/common/http';
import { Observable, tap, map, catchError, throwError } from 'rxjs';
import { environment } from '@env/environment';

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
        }),
        catchError(err => throwError(() => new Error(err.error?.mensaje || 'Error en login')))
      );
  }

  verifySession(): Observable<boolean> {
    const token = this.getToken();
    if (!token) return of(false);
    return this.http.get<{ valido: boolean; usuario: any }>(`${environment.apiUrl}/auth/verify`).pipe(
      tap((res) => {
        const usuario: Usuario = {
          ...res.usuario,
          nombre: res.usuario.nombre || res.usuario.username,
        };
        sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(usuario));
        this.usuarioSubject.next(usuario);
      }),
      map(() => true),
      catchError(() => {
        this.logout();
        return of(false);
      }),
    );
  }

  cambiarPassword(cedula: string, newPassword: string): Observable<any> {
    return this.http.put(`${environment.apiUrl}/auth/cambiar-password`, { cedula, newPassword });
  }

  solicitarRecuperacion(email: string, cedula: string): Observable<any> {
    return this.http.post(`${environment.apiUrl}/auth/recuperacion/solicitar`, { email, cedula });
  }

  verificarOTP(email: string, cedula: string, codigo: string): Observable<any> {
    return this.http.post(`${environment.apiUrl}/auth/recuperacion/verificar`, { email, cedula, codigo });
  }

  restablecerPassword(email: string, cedula: string, codigo: string, newPassword: string): Observable<any> {
    return this.http.post(`${environment.apiUrl}/auth/recuperacion/restablecer`, { email, cedula, codigo, newPassword });
  }

  cerrarSesion(): Observable<any> {
    return this.http.post(`${environment.apiUrl}/auth/logout`, {});
  }

  logout() {
    this.cerrarSesion().subscribe({ error: () => {} });
    this.limpiarSesion();
  }

  /**
   * Cierre de sesión de emergencia usando fetch con keepalive.
   * Útil para eventos como beforeunload donde HttpClient puede ser cancelado.
   */
  emergencyLogout() {
    const token = this.getToken();
    if (token) {
      fetch(`${environment.apiUrl}/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        keepalive: true
      });
    }
    this.limpiarSesion();
  }

  private limpiarSesion() {
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

  tienePermiso(permiso: string): boolean {
    const usuario = this.usuarioSubject.value;
    if (!usuario || !usuario.permisos) return false;
    return usuario.permisos.includes(permiso);
  }

  tienePermisos(permisos: string[]): boolean {
    const usuario = this.usuarioSubject.value;
    if (!usuario || !usuario.permisos) return false;
    return permisos.some(p => usuario.permisos.includes(p));
  }

  private cargarSesion(): Usuario | null {
    try {
      const data = sessionStorage.getItem(this.STORAGE_KEY);
      if (!data) return null;
      
      const usuario: Usuario = JSON.parse(data);
      
      // Si el usuario no tiene id_sede, la sesión es inválida
      if (usuario.rol !== 'recepcionista' && usuario.id !== 0 && !usuario.id_sede) {
        console.warn('Sesión antigua detectada (sin id_sede). Limpiando...');
        sessionStorage.removeItem(this.STORAGE_KEY);
        sessionStorage.removeItem(this.TOKEN_KEY);
        return null;
      }
      
      return usuario;
    } catch {
      return null;
    }
  }
}
