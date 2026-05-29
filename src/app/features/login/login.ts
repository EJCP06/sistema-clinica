import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { ThemeService } from '@core/services/theme.service';
import { SwalService } from '../../core/services/swal.service';
import { LucideAngularModule, Eye, EyeOff, LogIn, Activity, User, Lock, Sun, Moon, XCircle } from 'lucide-angular';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
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

  private auth = inject(AuthService);
  private themeService = inject(ThemeService);
  private router = inject(Router);
  private swal = inject(SwalService);

  cedula = '';
  password = '';
  mostrarPassword = false;
  cargando = false;

  get isDarkMode() { return this.themeService.isDarkMode(); }
  set isDarkMode(val: boolean) { this.themeService.setTheme(val); }

  toggleDarkMode() {
    this.themeService.toggleTheme();
  }

  iniciarSesion() {
    if (!this.cedula || !this.password) {
      this.swal.warning('Por favor ingrese su cédula y contraseña.');
      return;
    }
    this.auth.login(this.cedula, this.password).subscribe({
      next: (response) => {
        this.cargando = false;
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
