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

  username = '';
  password = '';
  mostrarPassword = false;
  error = '';
  cargando = false;

  get isDarkMode() { return this.themeService.isDarkMode(); }
  set isDarkMode(val: boolean) { this.themeService.setTheme(val); }

  toggleDarkMode() {
    this.themeService.toggleTheme();
  }

  readonly cuentasDemo = [
    { label: 'Administrador', user: 'admin', icon: '⚙️' },
    { label: 'Recepcionista', user: 'recepcion1', icon: '🧑‍💼' },
    { label: 'Médico Pediatría', user: 'medico_ped', icon: '🩺' },
    { label: 'Médico Ginecología', user: 'medico_gin', icon: '🩺' },
    { label: 'Pantalla Pública (TV)', user: 'tv', icon: '📺' },
  ];

  usarCuenta(user: string) {
    this.username = user;
    this.password = '123'; // Contraseña real en la BD
    this.error = '';
  }

  iniciarSesion() {
    if (!this.username || !this.password) {
      this.error = 'Por favor ingrese usuario y contraseña.';
      return;
    }
    this.cargando = true;
    this.error = '';

    this.auth.login(this.username, this.password).subscribe({
      next: (response) => {
        this.cargando = false;
        // Forzamos la navegación desde el componente para asegurar el cambio de vista
        const usuario = this.auth.usuarioActual;
        if (usuario) {
          const rol = usuario.rol;
          if (rol === 'admin') this.router.navigate(['/admin']);
          else if (rol === 'recepcionista') this.router.navigate(['/recepcion']);
          else if (rol === 'medico') this.router.navigate(['/atencion']);
          else this.router.navigate(['/atencion']); // Fallback para médicos si el rol viene distinto
        }
      },
      error: (err: Error) => {
        this.error = err.message || 'Usuario o contraseña incorrectos.';
        this.cargando = false;
      }
    });
  }
}
