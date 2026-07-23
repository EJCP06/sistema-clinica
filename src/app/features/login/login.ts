import { Component, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { ThemeService } from '@core/services/theme.service';
import { SwalService } from '../../core/services/swal.service';
import { LucideAngularModule, Eye, EyeOff, LogIn, Activity, User, Lock, Sun, Moon, CircleX, KeyRound, ArrowLeft, MonitorSpeaker, Mail, Shield, Clock, CircleCheck } from 'lucide-angular';
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

  constructor() {
    setTimeout(() => this.initialTransitionDisabled = false, 100);
  }

  ngOnDestroy() {
    this.detenerTemporizador();
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
    this.detenerTemporizador();
  }

  private detenerTemporizador() {
    if (this.intervaloTemporizador) {
      clearInterval(this.intervaloTemporizador);
      this.intervaloTemporizador = null;
    }
  }

  private iniciarTemporizador(segundos: number) {
    this.tiempoRestante = segundos;
    this.detenerTemporizador();
    this.intervaloTemporizador = setInterval(() => {
      this.tiempoRestante--;
      if (this.tiempoRestante <= 0) {
        this.detenerTemporizador();
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
      this.cargando = true;
      const inicio = Date.now();
      const MIN_CARGANDO = 800;

      this.auth.login(this.cedula, this.password).subscribe({
        next: () => this.procesarLogin(inicio),
        error: (err: any) => {
          const elapsed = Date.now() - inicio;
          const restante = Math.max(0, MIN_CARGANDO - elapsed);
          const mostrarError = () => {
            this.cargando = false;
            if (err.status === 409) {
              Swal.fire({
                icon: 'warning',
                title: 'Sesión activa',
                text: err.error?.mensaje || 'Ya hay una sesión activa con este usuario.',
                confirmButtonColor: '#2563eb',
              });
            } else if (err.status === 403) {
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
      const elapsed = Date.now() - inicio;
      if (elapsed < 800) {
        await new Promise(r => setTimeout(r, 800 - elapsed));
      }
      const usuario = this.auth.usuarioActual;
      if (!usuario) {
        this.cargando = false;
        this.swal.error('Error al cargar datos del usuario');
        return;
      }
      const rutaInicial = this.auth.obtenerRutaInicial();
      if (rutaInicial === '/login') {
        this.cargando = false;
        this.swal.error('Su usuario no tiene permisos asignados para acceder al sistema');
        this.router.navigate(['/login']);
        return;
      }
      this.router.navigateByUrl(rutaInicial);
    }
  }