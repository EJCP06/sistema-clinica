import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { ThemeService } from '@core/services/theme.service';
import { SwalService } from '../../core/services/swal.service';
import { LucideAngularModule, Eye, EyeOff, LogIn, Activity, User, Lock, Sun, Moon, XCircle, KeyRound, ArrowLeft, MonitorSpeaker } from 'lucide-angular';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, RouterLink],
  templateUrl: './login.html',
  styles: []
})
export class Login {
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

  private auth = inject(AuthService);
  private themeService = inject(ThemeService);
  private router = inject(Router);
  private swal = inject(SwalService);

  cedula = '';
  password = '';
  mostrarPassword = false;
  cargando = false;
  mostrarResetPassword = false;
  resetCedula = '';
  newPassword = '';
  confirmPassword = '';
  mostrarNewPassword = false;
  cargandoReset = false;
  initialTransitionDisabled = true;

  constructor() {
    // Deshabilitar la transición inicial para evitar el efecto de "recarga" del toggle
    setTimeout(() => this.initialTransitionDisabled = false, 100);
  }

  get isDarkMode() {
    return this.themeService.isDarkMode();
  }

  toggleDarkMode() {
    this.themeService.toggleTheme();
  }

  toggleResetPassword() {
    this.mostrarResetPassword = !this.mostrarResetPassword;
    this.resetCedula = '';
    this.newPassword = '';
    this.confirmPassword = '';
  }

  cambiarPassword() {
    if (!this.resetCedula || !this.newPassword || !this.confirmPassword) {
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
    this.auth.cambiarPassword(this.resetCedula, this.newPassword).subscribe({
      next: () => {
        this.swal.success('Contraseña actualizada exitosamente');
        this.mostrarResetPassword = false;
        this.newPassword = '';
        this.confirmPassword = '';
        this.cargandoReset = false;
      },
      error: (err) => {
        this.swal.error(err.error?.mensaje || 'Error al cambiar contraseña');
        this.cargandoReset = false;
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
      },
      error: (err: any) => {
        this.swal.error(err.error?.mensaje || err.message || 'Error de autenticación');
        this.cargando = false;
      }
    });
  }
}
