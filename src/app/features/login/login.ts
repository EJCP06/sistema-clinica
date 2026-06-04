import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { ThemeService } from '@core/services/theme.service';
import { SwalService } from '../../core/services/swal.service';
import { LucideAngularModule, Eye, EyeOff, LogIn, Activity, User, Lock, Sun, Moon, XCircle, KeyRound, ArrowLeft, MonitorSpeaker, Mail, Shield, Clock, CheckCircle2 } from 'lucide-angular';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, RouterLink],
  templateUrl: './login.html',
  styles: []
})
export class Login implements OnDestroy {
  readonly Eye = Eye;
  readonly EyeOff = EyeOff;
  readonly LogIn = LogIn;
  readonly Activity = Activity;
  readonly User = User;
  readonly Lock = Lock;
  readonly Sun = Sun;
  readonly Moon = Moon;
  readonly XCircle = XCircle;
  readonly KeyRound = KeyRound;
  readonly ArrowLeft = ArrowLeft;
  readonly MonitorSpeaker = MonitorSpeaker;
  readonly Mail = Mail;
  readonly Shield = Shield;
  readonly Clock = Clock;
  readonly CheckCircle2 = CheckCircle2;

  private auth = inject(AuthService);
  private themeService = inject(ThemeService);
  private router = inject(Router);
  private swal = inject(SwalService);

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
   private intervaloTemporizador: any = null;

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
    if (!this.mostrarResetPassword) {
      this.resetearRecuperacion();
    } else {
      this.paso = 1;
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
    this.auth.solicitarRecuperacion(this.recuperacionEmail, this.recuperacionCedula).subscribe({
      next: (res) => {
        this.cargandoReset = false;
        this.paso = 2;
        this.recuperacionCodigo = '';
        this.iniciarTemporizador(res.expiracion || 300);
        this.swal.success('Nuevo código enviado a tu correo. Revisa el mensaje más reciente.');
      },
      error: (err) => {
        this.cargandoReset = false;
        this.swal.error(err.error?.mensaje || 'Error al enviar el código');
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
    this.auth.verificarOTP(this.recuperacionEmail, this.recuperacionCedula, this.recuperacionCodigo).subscribe({
      next: () => {
        this.cargandoReset = false;
        this.swal.success('Código de recuperación exitoso');
        this.paso = 3;
        this.detenerTemporizador();
      },
      error: (err) => {
        this.cargandoReset = false;
        this.swal.error(err.error?.mensaje || 'Código incorrecto');
      }
    });
  }

  restablecerPassword() {
    if (!this.newPassword || !this.confirmPassword) {
      this.swal.warning('Complete todos los campos');
      return;
    }
    if (this.newPassword.length < 4) {
      this.swal.warning('La contraseña debe tener al menos 4 caracteres');
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.swal.warning('Las contraseñas no coinciden');
      return;
    }
    this.cargandoReset = true;
    this.auth.restablecerPassword(this.recuperacionEmail, this.recuperacionCedula, this.recuperacionCodigo, this.newPassword).subscribe({
      next: () => {
        this.cargandoReset = false;
        this.swal.success('Contraseña actualizada exitosamente');
        this.mostrarResetPassword = false;
        this.resetearRecuperacion();
      },
      error: (err) => {
        this.cargandoReset = false;
        this.swal.error(err.error?.mensaje || 'Error al restablecer la contraseña');
      }
    });
  }

    iniciarSesion() {
     if (!this.cedula || !this.password) {
       this.swal.warning('Por favor ingrese su cédula y contraseña.');
       return;
     }
     this.cargando = true;

     this.auth.login(this.cedula, this.password).subscribe({
       next: (response) => {
         const usuario = this.auth.usuarioActual;
         if (usuario) {
           const rol = usuario.rol;
           if (rol === 'admin') this.router.navigate(['/admin']);
           else if (rol === 'recepcionista') this.router.navigate(['/recepcion']);
           else if (rol === 'medico') this.router.navigate(['/atencion']);
           else if (rol === 'aps') this.router.navigate(['/aps']);
           else if (rol === 'laboratorio') {
             if (usuario.consultorio_id) this.router.navigate(['/atencion'], { queryParams: { tipo: 'laboratorio' } });
             else this.router.navigate(['/atencion-laboratorio']);
           }
           else if (rol === 'imagenes') {
             if (usuario.consultorio_id) this.router.navigate(['/atencion'], { queryParams: { tipo: 'imagenes' } });
             else this.router.navigate(['/atencion-imagenes']);
           }
           else this.router.navigate(['/atencion']);
         }
         // Keep cargando true during redirect - it will be reset on new page load
       },
       error: (err: any) => {
         this.cargando = false;
         this.swal.error(err.error?.mensaje || err.message || 'Error de autenticación');
       }
     });
   }
}
