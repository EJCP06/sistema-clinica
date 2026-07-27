import { Injectable, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Subscription, of, Observable, tap, map, catchError, throwError } from 'rxjs';
import { Usuario, Rol } from '@core/models/usuario.model';

import { HttpClient } from '@angular/common/http';
import { environment } from '@env/environment';
import { ApiService } from './api.service';
import { VISTA_POR_PERMISO } from '@core/config/permisos.config';
import Swal from 'sweetalert2';

/**
 * Servicio central de autenticación.
 * Gestiona sesión (login/logout/refresh), almacenamiento en sessionStorage,
 * verificación de permisos, recuperación de contraseña y escucha
 * eventos en tiempo real de desactivación/actualización de permisos.
 */
@Injectable({ providedIn: 'root' })
export class AuthService implements OnDestroy {
  private readonly STORAGE_KEY = 'clinica_usuario';
  private readonly TOKEN_KEY = 'clinica_token';
  private readonly usuarioSubject = new BehaviorSubject<Usuario | null>(this.cargarSesion());
  private readonly permisosSub: Subscription;

  private readonly LEGACY_KEY_MAP: Record<string, string> = {
    ver_reportes: 'reportes:ver',
    admin_panel: 'admin:panel',
    admision_crear: 'admision:crear',
    admision_editar: 'admision:editar',
    admision_eliminar: 'admision:eliminar',
    admision_asignar_turno: 'admision:asignar_turno',
    aps_enviar_presupuesto: 'aps:enviar_presupuesto',
    aps_solicitar_clave: 'aps:solicitar_clave',
    aps_enviar_sala_espera: 'aps:enviar_sala_espera',
    aps_aprobar_clave: 'aps:aprobar_clave',
    aps_reincorporar: 'aps:reincorporar',
    laboratorio_registrar_caja: 'laboratorio:registrar_caja',
    laboratorio_pasar_sala_espera: 'laboratorio:pasar_sala_espera',
    laboratorio_marcar_ausente: 'laboratorio:marcar_ausente',
    laboratorio_reincorporar: 'laboratorio:reincorporar',
    imagenes_registrar_caja: 'imagenes:registrar_caja',
    imagenes_pasar_sala_espera: 'imagenes:pasar_sala_espera',
    imagenes_marcar_ausente: 'imagenes:marcar_ausente',
    imagenes_reincorporar: 'imagenes:reincorporar',
    llamado_laboratorio: 'llamado:laboratorio',
    llamado_imagenes: 'llamado:imagenes',
    aseguradoras_crear: 'aseguradoras:crear',
    aseguradoras_editar: 'aseguradoras:editar',
    aseguradoras_eliminar: 'aseguradoras:eliminar',
    aseguradoras_importar_excel: 'aseguradoras:importar_excel',
    atencion_medica_llamar_siguiente: 'atencion_medica:llamar_siguiente',
    atencion_medica_liberar_consultorio: 'atencion_medica:liberar_consultorio',
    atencion_medica_iniciar: 'atencion_medica:iniciar',
    atencion_medica_marcar_ausente: 'atencion_medica:marcar_ausente',
    atencion_medica_finalizar: 'atencion_medica:finalizar',
    especialidades_crear: 'especialidades:crear',
    especialidades_editar: 'especialidades:editar',
    especialidades_eliminar: 'especialidades:eliminar',
    personal_crear: 'personal:crear',
    personal_editar: 'personal:editar',
    personal_eliminar: 'personal:eliminar',
    roles_crear: 'roles:crear',
    roles_editar: 'roles:editar',
    roles_eliminar: 'roles:eliminar',
    gestionar_permisos: 'permisologia:gestionar_permisos',
    gestionar_sedes: 'sedes:gestionar',
    gestionar_servicios: 'servicios:gestionar',
    admision: 'admision:*',
    ver_aps: 'aps:ver',
    ver_aseguradoras: 'aseguradoras:ver',
    laboratorio: 'laboratorio:*',
    imagenes: 'imagenes:*',
    atencion_medica: 'atencion_medica:*',
    llamar_siguiente: 'atencion_medica:llamar_siguiente',
    liberar_consultorio: 'atencion_medica:liberar_consultorio',
    marcar_ausente: '*:marcar_ausente',
    reincorporar: '*:reincorporar',
  };

  usuario$ = this.usuarioSubject.asObservable();

  constructor(private readonly router: Router, private readonly http: HttpClient, private readonly api: ApiService) {
    this.permisosSub = this.api.cambios$.subscribe((data) => {
      const event = data as any;

      if (event.tipo === 'permisos' && event.id_rol) {
        const usuario = this.usuarioActual;
        if (usuario?.id_rol && usuario.id_rol === event.id_rol) {
          Swal.fire({
            icon: 'info',
            title: 'Permisos actualizados',
            text: 'Tus permisos han sido modificados. Debes iniciar sesión nuevamente.',
            timer: 10000,
            timerProgressBar: true,
            confirmButtonColor: '#2563eb',
            willClose: () => {
              this.emergencyLogout();
            },
          });
        }
      }

      if (event.tipo === 'usuario-desactivado' && this.usuarioActual) {
        Swal.fire({
          icon: 'warning',
          title: 'Usuario desactivado',
          text: 'Tu cuenta ha sido desactivada por un administrador. Serás redirigido al inicio de sesión.',
          confirmButtonColor: '#2563eb',
          allowOutsideClick: false,
          willClose: () => {
            this.emergencyLogout();
          },
        });
      }

      if (event.tipo === 'sede-cambiada' && this.usuarioActual) {
        Swal.fire({
          icon: 'warning',
          title: 'Sede cambiada',
          text: 'Tu sede ha sido modificada por un administrador. Debes iniciar sesión nuevamente.',
          confirmButtonColor: '#2563eb',
          allowOutsideClick: false,
          willClose: () => {
            this.emergencyLogout();
          },
        });
      }

      if (event.tipo === 'sesion-cerrada') {
        Swal.fire({
          icon: 'warning',
          title: 'Sesión cerrada',
          text: 'Tu sesión ha sido cerrada desde otro dispositivo. Debes iniciar sesión nuevamente.',
          confirmButtonColor: '#2563eb',
          allowOutsideClick: false,
          willClose: () => {
            this.emergencyLogout();
          },
        });
      }
    });
  }

  ngOnDestroy() {
    this.permisosSub?.unsubscribe();
  }

  get usuarioActual(): Usuario | null {
    return this.usuarioSubject.value;
  }

  getToken(): string | null {
    return sessionStorage.getItem(this.TOKEN_KEY);
  }

  login(username: string, password: string): Observable<any> {
    return this.http.post<{mensaje: string, token: string, usuario: any}>(`${environment.apiUrl}/auth/login`, { username, password }, { withCredentials: true })
      .pipe(
        tap(response => {
          const usuario: Usuario = {
            ...response.usuario,
            nombre: response.usuario.nombre || response.usuario.username
          };
          sessionStorage.setItem(this.TOKEN_KEY, response.token);
          sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(usuario));
          this.api.actualizarSocketToken(response.token);
          this.usuarioSubject.next(usuario);
        }),
        catchError(err => throwError(() => err))
      );
  }

  refreshSession(): Observable<{ token: string; usuario: any } | null> {
    return this.http.post<{ token: string; usuario: any }>(
      `${environment.apiUrl}/auth/refresh`, {}, { withCredentials: true }
    ).pipe(
      tap(res => {
        sessionStorage.setItem(this.TOKEN_KEY, res.token);
        const usuario: Usuario = { ...res.usuario, nombre: res.usuario.nombre || res.usuario.username };
        sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(usuario));
        this.usuarioSubject.next(usuario);
        this.api.actualizarSocketToken(res.token);
      }),
      catchError(() => {
        this.logoutSilently();
        return of(null);
      }),
    );
  }

  verifySession(): Observable<boolean> {
    const token = this.getToken();
    if (!token) return of(false);
    const usuarioActual = this.usuarioActual;
    return this.http.get<{ valido: boolean; usuario: any }>(`${environment.apiUrl}/auth/verify`).pipe(
      tap((res) => {
        if (usuarioActual?.id_sede && res.usuario.id_sede && usuarioActual.id_sede !== res.usuario.id_sede) {
          Swal.fire({
            icon: 'warning',
            title: 'Sede cambiada',
            text: 'Tu sede ha sido modificada. Debes iniciar sesión nuevamente.',
            confirmButtonColor: '#2563eb',
            allowOutsideClick: false,
            willClose: () => {
              this.emergencyLogout();
            },
          });
          return;
        }
        const usuario: Usuario = {
          ...res.usuario,
          nombre: res.usuario.nombre || res.usuario.username,
        };
        sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(usuario));
        this.usuarioSubject.next(usuario);
      }),
      map(() => true),
      catchError(() => {
        this.logoutSilently();
        return of(false);
      }),
    );
  }

  cerrarSesion(): Observable<any> {
    return this.http.post(`${environment.apiUrl}/auth/logout`, {}, { withCredentials: true });
  }

  logout() {
    if (this.getToken()) {
      this.cerrarSesion().subscribe({
        next: () => this.limpiarSesion(),
        error: () => this.limpiarSesion()
      });
      return;
    }

    this.limpiarSesion();
  }

  logoutSilently() {
    this.limpiarSesionSinNavegar();
  }

  clearSession() {
    this.limpiarSesionSinNavegar();
  }

  private limpiarSesionSinNavegar() {
    sessionStorage.removeItem(this.STORAGE_KEY);
    sessionStorage.removeItem(this.TOKEN_KEY);
    this.api.actualizarSocketToken(null);
    this.usuarioSubject.next(null);
  }

  emergencyLogout() {
    const token = this.getToken();
    if (token) {
      fetch(`${environment.apiUrl}/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        keepalive: true,
        credentials: 'include',
      });
    }
    this.limpiarSesion();
  }

  private limpiarSesion() {
    sessionStorage.removeItem(this.STORAGE_KEY);
    sessionStorage.removeItem(this.TOKEN_KEY);
    this.api.actualizarSocketToken(null);
    this.usuarioSubject.next(null);
    if (this.router.url !== '/login') {
      this.router.navigate(['/login']);
    }
  }

  estaAutenticado(): boolean {
    return this.usuarioSubject.value !== null;
  }

  tieneRol(roles: Rol[]): boolean {
    const usuario = this.usuarioSubject.value;
    if (!usuario) return false;
    return roles.includes(usuario.rol);
  }

  tienePermiso(recurso: string, accion?: string): boolean {
    const usuario = this.usuarioSubject.value;
    if (!usuario?.permisos) return false;

    let rec = recurso;
    let acc = accion;

    if (!acc && recurso.includes(':')) {
      const parts = recurso.split(':');
      rec = parts[0];
      acc = parts[1];
    }

    if (acc) {
      if (acc === '*') {
        return usuario.permisos.some(p => p.startsWith(`${rec}:`) || p.startsWith(`*:`));
      }
      const claveRequerida = `${rec}:${acc}`;
      return usuario.permisos.includes(claveRequerida) || 
             usuario.permisos.includes(`*:${acc}`) || 
             usuario.permisos.includes(`${rec}:*`);
    }

    if (usuario.permisos.includes(recurso)) return true;

    const mapped = this.LEGACY_KEY_MAP[recurso];
    if (mapped) return this.tienePermiso(mapped);

    return false;
  }

  esCoordinador(): boolean {
    const usuario = this.usuarioSubject.value;
    return usuario?.rol === 'coordinador';
  }

  tienePermisos(permisos: string[]): boolean {
    return permisos.some(p => this.tienePermiso(p));
  }

  obtenerRutaInicial(): string {
    const usuario = this.usuarioSubject.value;
    if (!usuario) return '/login';

    if (usuario.rol === 'administrador') {
      return '/administrador?tab=reports';
    }

    const prioridadPermisos = [
      'ver_reportes',
      'admin_panel',
      'personal:ver',
      'roles:ver',
      'permisologia:ver',
      'especialidades:ver',
      'admision:ver',
      'aps:ver',
      'atencion_medica:ver',
      'laboratorio:ver',
      'imagenes:ver',
      'aseguradoras:ver',
    ];

    for (const permiso of prioridadPermisos) {
      if (this.tienePermiso(permiso)) {
        const ruta = VISTA_POR_PERMISO[permiso]?.ruta;
        if (ruta) return ruta;
      }
    }

    return '/login';
  }

  refrescarPermisos(): Observable<any> {
    return this.http.get(`${environment.apiUrl}/auth/permisos`).pipe(
      tap((res: any) => {
        const usuario = this.usuarioActual;
        if (usuario && res.permisos) {
          usuario.permisos = res.permisos;
          sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(usuario));
          this.usuarioSubject.next(usuario);
        }
      }),
    );
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

  private cargarSesion(): Usuario | null {
    try {
      const data = sessionStorage.getItem(this.STORAGE_KEY);
      if (!data) return null;
      
      const usuario: Usuario = JSON.parse(data);
      
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
