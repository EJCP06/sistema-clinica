import { Component, inject, Input, Output, EventEmitter } from '@angular/core';
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
  ClipboardList
} from 'lucide-angular';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule, LucideAngularModule, FormsModule],
  templateUrl: './header.html',
  styles: [],
})
export class Header {
  readonly Activity = Activity;
  readonly LogOut = LogOut;
  readonly User = User;
  readonly Sun = Sun;
  readonly Moon = Moon;
  readonly Menu = Menu;
  readonly Users = Users;
  readonly Ticket = Ticket;
  readonly ClipboardList = ClipboardList;

  @Input() title: string = '';
  @Input() subtitle: string = '';
  @Input() showLogo: boolean = true;
  @Input() showMenuButton: boolean = false;
  @Output() toggleSidebar = new EventEmitter<void>();

  private auth = inject(AuthService);
  private themeService = inject(ThemeService);

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
  set isDarkMode(val: boolean) {
    this.themeService.setTheme(val);
  }

  toggleDarkMode() {
    this.themeService.toggleTheme();
  }

  logout() {
    this.auth.logout();
  }
}
