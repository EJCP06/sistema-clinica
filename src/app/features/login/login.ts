import { Component, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { ThemeService } from '@core/services/theme.service';
import { SwalService } from '../../core/services/swal.service';
import { LucideAngularModule, Eye, EyeOff, LogIn, Activity, User, Lock, Sun, Moon, CircleX, KeyRound, ArrowLeft, MonitorSpeaker, Mail, Shield, Clock, CircleCheck, Stethoscope } from 'lucide-angular';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, RouterLink],
  templateUrl: './login.html',
  styles: []
})
/**
 * Pantalla de inicio de sesión y recuperación de contraseña.
 * Implementa flujo de 3 pasos: solicitar código OTP → verificar → restablecer.
 */
export class Login implements OnDestroy {
  readonly Eye = Eye;
  readonly EyeOff = EyeOff;
  readonly LogIn = LogIn;
  readonly Activity = Activity;
  readonly User = User;
  readonly Lock = Lock;
  readonly Sun = Sun;
  readonly Moon = Moon;
  readonly XCircle = CircleX;
  readonly KeyRound = KeyRound;
  readonly ArrowLeft = ArrowLeft;
  readonly MonitorSpeaker = MonitorSpeaker;
  readonly Mail = Mail;
  readonly Shield = Shield;
  readonly Clock = Clock;
  readonly CheckCircle2 = CircleCheck;
  readonly Stethoscope = Stethoscope;

  private readonly auth = inject(AuthService);
  private readonly themeService = inject(ThemeService);
  private readonly router = inject(Router);
  private readonly swal = inject(SwalService);

  cedula = '';
  password = '';
  mostrarPassword = false;
  cargando = false;
  mostrarResetPassword = false;
  initialTransitionDisabled = true;

  // Selector de especialidad (médicos con varios especialidades activas)
  mostrarSelectorEspecialidad = false;
  especialidadesParaElegir: { id: number; nombre: string }[] = [];
  espSeleccionada: number | null = null;
  cargandoSelector = false;

  // Selector de roles (usuarios con varios roles asignados)
  mostrarSelectorRoles = false;
  rolesParaElegir: { id: number; key: string; nombre: string; activo?: boolean }[] = [];
  rolSeleccionado: number | null = null;
  cargandoSelectorRol = false;

  recuperacionEmail = '';
  recuperacionCedula = '';
  recuperacionCodigo = '';
  newPassword = '';
  confirmPassword = '';
   mostrarNewPassword = false;
   mostrarConfirmPassword = false;
   cargandoReset = false;
   paso = 1;
   tiempoRestante = 0;
  private intervaloTemporizador: ReturnType<typeof setInterval> | null = null;

  /** Clave en sessionStorage para persistir la recuperación entre recargas (F5). */
  private static readonly RECUPERACION_KEY = 'login_recuperacion';

  constructor() {
    setTimeout(() => this.initialTransitionDisabled = false, 100);
    // Guarda la recuperación en curso al recargar (F5) o salir de la página,
    // para poder restaurarla al volver.
    window.addEventListener('pagehide', this.guardarAlSalir);
    this.restaurarRecuperacion();
  }

  ngOnDestroy() {
    this.detenerTemporizador();
    window.removeEventListener('pagehide', this.guardarAlSalir);
  }

  /** Guarda la recuperación en curso al recargar/cerrar la página (F5 incluido). */
  private readonly guardarAlSalir = () => {
    if (this.mostrarResetPassword && this.paso > 1) {
      this.guardarRecuperacion();
    }
  };

  /** Hora límite (epoch ms) en que expira el código OTP, para recalcular el temporizador tras recargar. */
  private codigoVenceEn: number | null = null;

  /** Persiste el estado actual de la recuperación para sobrevivir a recargas. */
  guardarRecuperacion() {
    try {
      sessionStorage.setItem(Login.RECUPERACION_KEY, JSON.stringify({
        paso: this.paso,
        email: this.recuperacionEmail,
        cedula: this.recuperacionCedula,
        codigo: this.recuperacionCodigo,
        newPassword: this.newPassword,
        confirmPassword: this.confirmPassword,
        // Hora real en que expira el código (fijada al enviarlo), para que la
        // cuenta regresiva sea correcta incluso si pasó tiempo entre guardados.
        venceEn: this.codigoVenceEn
      }));
    } catch { /* almacenamiento no disponible */ }
  }

  /** Limpia la recuperación persistida (al completarla o salir del flujo). */
  private limpiarRecuperacionGuardada() {
    try {
      sessionStorage.removeItem(Login.RECUPERACION_KEY);
    } catch { /* almacenamiento no disponible */ }
  }

  /**
   * Al abrir la pantalla de login, si el usuario venía a mitad de una
   * recuperación (recargó con F5, por ejemplo), lo devuelve a la misma fase
   * con sus datos y el temporizador recalculado.
   */
  private restaurarRecuperacion() {
    try {
      const raw = sessionStorage.getItem(Login.RECUPERACION_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      // Restaurar solo si hay una recuperación en curso con datos válidos.
      // Se restaura cualquier paso (1 a 3): así el usuario vuelve exactamente
      // a donde estaba antes de recargar la página.
      if (!s || !s.email || !s.cedula || !s.paso || s.paso < 1 || s.paso > 3) {
        this.limpiarRecuperacionGuardada();
        return;
      }
      this.recuperacionEmail = s.email;
      this.recuperacionCedula = s.cedula;
      this.recuperacionCodigo = s.codigo || '';
      this.newPassword = s.newPassword || '';
      this.confirmPassword = s.confirmPassword || '';
      this.paso = s.paso;
      this.mostrarResetPassword = true;
      // Si el código aún no vence, reanudar la cuenta regresiva con el tiempo
      // real restante; si ya venció, dejar el temporizador en 0 (muestra
      // "Código expirado" y permite reenviar).
      if (s.paso === 2 && s.venceEn) {
        // Fijar la hora de vencimiento ORIGINAL guardada: la cuenta regresiva
        // reanuda con el tiempo real que queda (no se reinicia completa).
        this.codigoVenceEn = Number(s.venceEn);
        this.iniciarTemporizador(0);
      }
    } catch {
      this.limpiarRecuperacionGuardada();
    }
  }

  get isDarkMode() {
    return this.themeService.isDarkMode();
  }

  soloNumeros(event: KeyboardEvent) {
    if (!/^\d$/.test(event.key) && event.key !== 'Backspace' && event.key !== 'Delete' && event.key !== 'Tab' && event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      event.preventDefault();
    }
  }

  toggleDarkMode() {
    this.themeService.toggleTheme();
  }

  toggleResetPassword() {
    this.mostrarResetPassword = !this.mostrarResetPassword;
    if (this.mostrarResetPassword) {
      this.paso = 1;
    } else {
      this.resetearRecuperacion();
      this.limpiarRecuperacionGuardada();
    }
  }

  private resetearRecuperacion() {
    this.recuperacionEmail = '';
    this.recuperacionCedula = '';
    this.recuperacionCodigo = '';
    this.newPassword = '';
    this.confirmPassword = '';
    this.paso = 1;
    this.tiempoRestante = 0;
    this.codigoVenceEn = null;
    this.detenerTemporizador();
  }

  private detenerTemporizador() {
    if (this.intervaloTemporizador) {
      clearInterval(this.intervaloTemporizador);
      this.intervaloTemporizador = null;
    }
  }

  private iniciarTemporizador(segundos: number) {
    // Si ya hay una hora de vencimiento fijada (p. ej. al restaurar tras una
    // recarga con el código aún vigente), se conserva; si no, se fija a partir
    // de ahora. Así la cuenta regresiva siempre termina en el momento real en
    // que expira el código.
    if (!this.codigoVenceEn) {
      this.codigoVenceEn = Date.now() + segundos * 1000;
    }
    this.tiempoRestante = Math.max(0, Math.floor((this.codigoVenceEn - Date.now()) / 1000));
    this.detenerTemporizador();
    this.intervaloTemporizador = setInterval(() => {
      // Basarse en la hora real de vencimiento: así el conteo nunca se
      // desvía aunque el intervalo se retrase.
      this.tiempoRestante = Math.max(0, Math.floor((this.codigoVenceEn! - Date.now()) / 1000));
      if (this.tiempoRestante <= 0) {
        this.detenerTemporizador();
        this.codigoVenceEn = null;
      }
    }, 1000);
  }

  get tiempoFormateado(): string {
    const m = Math.floor(this.tiempoRestante / 60);
    const s = this.tiempoRestante % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  get tiempoAgotado(): boolean {
    return this.tiempoRestante <= 0;
  }

  solicitarCodigo() {
    if (!this.recuperacionEmail || !this.recuperacionCedula) {
      this.swal.warning('Complete su correo y cédula');
      return;
    }
    // Guardar lo escrito en el paso 1 por si recarga la página mientras
    // espera el correo con el código.
    this.guardarRecuperacion();
    this.cargandoReset = true;
    const inicio = Date.now();
    const MIN_CARGANDO = 800;

    this.auth.solicitarRecuperacion(this.recuperacionEmail, this.recuperacionCedula).subscribe({
      next: (res) => {
        const elapsed = Date.now() - inicio;
        const restante = Math.max(0, MIN_CARGANDO - elapsed);
        setTimeout(() => {
          this.cargandoReset = false;
          this.paso = 2;
          this.recuperacionCodigo = '';
          this.iniciarTemporizador(res.expiracion || 300);
          this.guardarRecuperacion();
          this.swal.success('Nuevo código enviado a tu correo. Revisa el mensaje más reciente.');
        }, restante);
      },
      error: (err) => {
        const elapsed = Date.now() - inicio;
        const restante = Math.max(0, MIN_CARGANDO - elapsed);
        setTimeout(() => {
          this.cargandoReset = false;
          this.swal.error(err.error?.mensaje || 'Error al enviar el código');
        }, restante);
      }
    });
  }

  verificarCodigo() {
    if (!this.recuperacionCodigo || this.recuperacionCodigo.length < 6) {
      this.swal.warning('Ingrese el código de 6 dígitos');
      return;
    }
    if (this.tiempoAgotado) {
      this.swal.warning('El código ha expirado. Solicita uno nuevo.');
      return;
    }
    this.cargandoReset = true;
    const inicio = Date.now();
    const MIN_CARGANDO = 800;

    this.auth.verificarOTP(this.recuperacionEmail, this.recuperacionCedula, this.recuperacionCodigo).subscribe({
      next: () => {
        const elapsed = Date.now() - inicio;
        const restante = Math.max(0, MIN_CARGANDO - elapsed);
        setTimeout(() => {
          this.cargandoReset = false;
          this.swal.success('Código de recuperación exitoso');
          this.paso = 3;
          this.detenerTemporizador();
          this.guardarRecuperacion();
        }, restante);
      },
      error: (err) => {
        const elapsed = Date.now() - inicio;
        const restante = Math.max(0, MIN_CARGANDO - elapsed);
        setTimeout(() => {
          this.cargandoReset = false;
          this.swal.error(err.error?.mensaje || 'Código incorrecto');
        }, restante);
      }
    });
  }

  restablecerPassword() {
    if (!this.newPassword || !this.confirmPassword) {
      this.swal.warning('Complete todos los campos');
      return;
    }
    if (this.newPassword.length < 8) {
      this.swal.warning('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.swal.warning('Las contraseñas no coinciden');
      return;
    }
    this.cargandoReset = true;
    const inicio = Date.now();
    const MIN_CARGANDO = 800;

    this.auth.restablecerPassword(this.recuperacionEmail, this.recuperacionCedula, this.recuperacionCodigo, this.newPassword).subscribe({
      next: () => {
        const elapsed = Date.now() - inicio;
        const restante = Math.max(0, MIN_CARGANDO - elapsed);
        setTimeout(() => {
          this.cargandoReset = false;
          this.swal.success('Contraseña actualizada exitosamente');
          this.mostrarResetPassword = false;
          this.resetearRecuperacion();
          this.limpiarRecuperacionGuardada();
        }, restante);
      },
      error: (err) => {
        const elapsed = Date.now() - inicio;
        const restante = Math.max(0, MIN_CARGANDO - elapsed);
        setTimeout(() => {
          this.cargandoReset = false;
          this.swal.error(err.error?.mensaje || 'Error al restablecer la contraseña');
        }, restante);
      }
    });
  }

    async iniciarSesion() {
     if (!this.cedula || !this.password) {
        this.swal.warning('Por favor ingrese su cédula y contraseña.');
        return;
      }
      // Al intentar un login normal, descartar cualquier recuperación previa
      // guardada (si se venía de una recarga a mitad de la recuperación).
      this.limpiarRecuperacionGuardada();
      this.cargando = true;
      const inicio = Date.now();
      // Tiempo mínimo de la animación "Cargando...": si el servidor responde
      // muy rápido, el botón igual muestra el spinner un instante visible y
      // después aparece el modal (o se entra al sistema).
      const MIN_CARGANDO = 200;

      this.auth.login(this.cedula, this.password).subscribe({
        next: () => this.procesarLogin(inicio),
        error: (err: any) => {
          const elapsed = Date.now() - inicio;
          const restante = Math.max(0, MIN_CARGANDO - elapsed);
          const mostrarError = () => {
            this.cargando = false;
            if (err.status === 403) {
              Swal.fire({
                icon: 'error',
                title: 'Usuario inactivo',
                text: err.error?.mensaje || 'Su usuario se encuentra inactivo. Contacte al administrador.',
                confirmButtonColor: '#2563eb',
              });
            } else {
              this.swal.error(err.error?.mensaje || err.message || 'Error de autenticación');
            }
          };
          if (restante > 0) setTimeout(mostrarError, restante);
          else mostrarError();
        }
      });
    }

    private async procesarLogin(inicio: number) {
      const usuario = this.auth.usuarioActual;
      if (!usuario) {
        // Sin datos: esperar la duración estándar antes del error
        const elapsed = Date.now() - inicio;
        if (elapsed < 800) await new Promise(r => setTimeout(r, 800 - elapsed));
        this.cargando = false;
        this.swal.error('Error al cargar datos del usuario');
        return;
      }
      // Médico con varias especialidades ACTIVAS: se le pregunta con cuál
      // entrar. El "Cargando..." dura MENOS (200ms) para que el modal de
      // especialidad aparezca rápido.
      const activas = Array.isArray(usuario.especialidades_activas) ? usuario.especialidades_activas : [];
      const roles = Array.isArray(usuario.roles) ? usuario.roles : [];
      const esMedicoConSelector = activas.length > 1;
      const tieneVariosRoles = roles.length > 1;
      const duracionCargando = (esMedicoConSelector || tieneVariosRoles) ? 100 : 800;
      const elapsed = Date.now() - inicio;
      if (elapsed < duracionCargando) {
        await new Promise(r => setTimeout(r, duracionCargando - elapsed));
      }
      // Primero verificar especialidades (médicos), luego roles
      if (esMedicoConSelector) {
        this.especialidadesParaElegir = activas;
        this.espSeleccionada = Number(usuario.id_especialidad) || activas[0].id;
        this.cargando = false;
        this.mostrarSelectorEspecialidad = true;
        return;
      }
      // Si tiene varios roles activos, preguntar con cuál entrar
      if (tieneVariosRoles) {
        this.rolesParaElegir = roles.filter(r => r.activo !== false);
        this.rolSeleccionado = Number(usuario.id_rol) || roles[0].id;
        this.cargando = false;
        this.mostrarSelectorRoles = true;
        return;
      }
      this.navegarAlInicio();
    }

    /** Navega a la ruta inicial del usuario (tras login o tras elegir especialidad). */
    private navegarAlInicio() {
      this.mostrarSelectorEspecialidad = false;
      const rutaInicial = this.auth.obtenerRutaInicial();
      if (rutaInicial === '/login') {
        this.cargando = false;
        this.swal.error('Su usuario no tiene permisos asignados para acceder al sistema');
        this.router.navigate(['/login']);
        return;
      }
      // Mantener "Cargando..." hasta que la navegación termine: el botón nunca
      // debe volver a "Iniciar Sesión" antes de entrar al sistema.
      this.router.navigateByUrl(rutaInicial).finally(() => {
        this.cargando = false;
      });
    }

    /**
     * Cierra el selector de especialidad (X, click fuera o Escape): cancela
     * el login y limpia la sesión para que el usuario vuelva a intentarlo.
     */
    cerrarSelectorEspecialidad() {
      this.mostrarSelectorEspecialidad = false;
      this.auth.logoutRapido();
    }

    /** Acepta la especialidad elegida: pide token nuevo y navega. */
    confirmarEspecialidad() {
      if (!this.espSeleccionada) return;
      this.cargandoSelector = true;
      const inicio = Date.now();
      const MIN_CARGANDO_SELECTOR = 200;

      this.auth.seleccionarEspecialidad(this.espSeleccionada).subscribe({
        next: () => {
          const restante = Math.max(0, MIN_CARGANDO_SELECTOR - (Date.now() - inicio));
          setTimeout(() => this.navegarAlInicio(), restante);
        },
        error: (err: any) => {
          const restante = Math.max(0, MIN_CARGANDO_SELECTOR - (Date.now() - inicio));
          setTimeout(() => {
            this.mostrarSelectorEspecialidad = false;
            this.cargandoSelector = false;
            this.swal.error(err.error?.mensaje || 'Error al seleccionar la especialidad');
          }, restante);
        }
      });
    }

    /**
     * Cierra el selector de roles (X, click fuera o Escape): cancela
     * el login y limpia la sesión para que el usuario vuelva a intentarlo.
     */
    cerrarSelectorRoles() {
      this.mostrarSelectorRoles = false;
      this.auth.logoutRapido();
    }

    /** Acepta el rol elegido: pide token nuevo y navega. */
    confirmarRol() {
      if (!this.rolSeleccionado) return;
      this.cargandoSelectorRol = true;
      const inicio = Date.now();
      const MIN_CARGANDO_SELECTOR = 200;

      this.auth.seleccionarRol(this.rolSeleccionado).subscribe({
        next: () => {
          const restante = Math.max(0, MIN_CARGANDO_SELECTOR - (Date.now() - inicio));
          setTimeout(() => this.navegarAlInicio(), restante);
        },
        error: (err: any) => {
          const restante = Math.max(0, MIN_CARGANDO_SELECTOR - (Date.now() - inicio));
          setTimeout(() => {
            this.mostrarSelectorRoles = false;
            this.cargandoSelectorRol = false;
            this.swal.error(err.error?.mensaje || 'Error al seleccionar el rol');
          }, restante);
        }
      });
    }
  }