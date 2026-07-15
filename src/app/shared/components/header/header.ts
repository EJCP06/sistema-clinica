import { Component, inject, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '@core/services/auth.service';
import { ThemeService } from '@core/services/theme.service';
import {
  LucideAngularModule,
  Sun,
  Moon,
  LogOut,
  Menu,
  Activity,
  User,
  Users,
  Ticket,
  ClipboardList,
  FlaskConical,
  Image
} from 'lucide-angular';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule, LucideAngularModule, FormsModule],
  templateUrl: './header.html',
  styles: [],
})
/**
 * Barra superior de la aplicación.
 * Muestra título, subtítulo, datos del usuario, botón de menú,
 * toggle de tema oscuro/claro y cierre de sesión.
 */
export class Header implements OnInit {
  readonly Activity = Activity;
  readonly LogOut = LogOut;
  readonly User = User;
  readonly Sun = Sun;
  readonly Moon = Moon;
  readonly Menu = Menu;
  readonly Users = Users;
  readonly Ticket = Ticket;
  readonly ClipboardList = ClipboardList;
  readonly FlaskConical = FlaskConical;
  readonly Image = Image;

  @Input() title: string = '';
  @Input() subtitle: string = '';
  @Input() showLogo: boolean = true;
  @Input() showMenuButton: boolean = false;
  @Output() toggleSidebar = new EventEmitter<void>();

  private auth = inject(AuthService);
  private themeService = inject(ThemeService);

  initialTransitionDisabled = true;
  cargando = false;

  get usuario() {
    return this.auth.usuarioActual;
  }

  get sedeNombre() {
    if (!this.usuario?.id_sede) return '';
    return this.usuario.id_sede === 1 ? 'Plaza Sucre' : 'Santa Mónica';
  }

  get isDarkMode() {
    return this.themeService.isDarkMode();
  }

  toggleDarkMode() {
    this.themeService.toggleTheme();
  }

  ngOnInit() {
    setTimeout(() => this.initialTransitionDisabled = false, 100);
  }

  logout() {
    this.cargando = true;
    const MIN_CARGANDO = 800;

    setTimeout(() => {
      this.auth.logout();
      this.cargando = false;
    }, MIN_CARGANDO);
  }
}
