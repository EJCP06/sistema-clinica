import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { ThemeService } from '@core/services/theme.service';
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

  cedula = '';
  password = '';
  mostrarPassword = false;
  error = '';
  cargando = false;

  get isDarkMode() { return this.themeService.isDarkMode(); }
  set isDarkMode(val: boolean) { this.themeService.setTheme(val); }

  toggleDarkMode() {
    this.themeService.toggleTheme();
  }

  onInputChange() {
    if (this.error) {
      this.error = '';

    }
  }

  iniciarSesion() {
    if (!this.cedula || !this.password) {
      this.error = 'Por favor ingrese su cédula y contraseña.';

      return;
    }
    this.cargando = true;
    this.error = '';

    this.auth.login(this.cedula, this.password).subscribe({
      next: (response) => {
        this.cargando = false;
        // Forzamos la navegación desde el componente para asegurar el cambio de vista
        const usuario = this.auth.usuarioActual;
        if (usuario) {
          const rol = usuario.rol;
          if (rol === 'admin') this.router.navigate(['/admin']);
          else if (rol === 'recepcionista') this.router.navigate(['/recepcion']);
          else if (rol === 'medico') this.router.navigate(['/atencion']);
          else if (rol === 'aps') this.router.navigate(['/aps']);
          else if (rol === 'laboratorio') this.router.navigate(['/laboratorio']);
          else if (rol === 'imagenes') this.router.navigate(['/imagenes']);
          else this.router.navigate(['/atencion']); // Fallback
        }
      },
      error: (err: any) => {
        this.error = err.error?.mensaje || err.message || 'Error de autenticación';
        this.cargando = false;
      }
    });
  }
}
