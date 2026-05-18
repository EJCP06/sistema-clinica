import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ThemeService } from '../../../core/services/theme.service';
import {
  LucideAngularModule,
  LayoutDashboard,
  BarChart3,
  UserCog,
  Stethoscope,
  LogOut, 
  XCircle, 
  LayoutGrid, 
  ShieldCheck,
  Users,
  Activity,
  DoorOpen,
  ChevronDown,
  Ticket,
  Sun,
  Moon,
  ClipboardList
} from 'lucide-angular';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, LucideAngularModule],
  templateUrl: './sidebar.html',
  styleUrls: []
})
export class Sidebar {
  @Input() activeTab: string = '';
  @Input() sidebarOpen: boolean = true;
  @Output() tabChange = new EventEmitter<string>();
  @Output() closeSidebar = new EventEmitter<void>();

  private auth = inject(AuthService);
  private themeService = inject(ThemeService);
  private router = inject(Router);

  // Icons
  readonly LayoutDashboard = LayoutDashboard;
  readonly BarChart3 = BarChart3;
  readonly UserCog = UserCog;
  readonly Stethoscope = Stethoscope;
  readonly LogOut = LogOut;
  readonly XCircle = XCircle;
  readonly LayoutGrid = LayoutGrid;
  readonly ShieldCheck = ShieldCheck;
  readonly Activity = Activity;
  readonly Users = Users;
  readonly DoorOpen = DoorOpen;
  readonly ChevronDown = ChevronDown;
  readonly Ticket = Ticket;
  readonly Sun = Sun;
  readonly Moon = Moon;
  readonly ClipboardList = ClipboardList;

  // Collapsible states
  expandedPanel = false;
  expandedOperaciones = false;
  expandedAdmin = false;

  toggleSection(section: string) {
    if (section === 'panel') this.expandedPanel = !this.expandedPanel;
    if (section === 'operaciones') this.expandedOperaciones = !this.expandedOperaciones;
    if (section === 'admin') this.expandedAdmin = !this.expandedAdmin;
  }

  get usuario() {
    return this.auth.usuarioActual;
  }

  get rol() {
    return this.usuario?.rol || '';
  }

  get sedeNombre() {
    if (!this.usuario?.id_sede) return '';
    return this.usuario.id_sede === 1 ? 'Santa Mónica' : 'Plaza Sucre';
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

  navigate(route: string, tab?: string) {
    if (route === 'admin') {
      this.router.navigate(['/admin'], { queryParams: { tab: tab } });
    } else {
      this.router.navigate([`/${route}`]);
    }
    // Auto-close sidebar on mobile after navigation
    this.closeSidebar.emit();
  }

  isActive(route: string, tab?: string): boolean {
    const currentRoute = this.router.url.split('?')[0];
    if (tab) {
      return currentRoute.includes(route) && this.router.url.includes(`tab=${tab}`);
    }
    return currentRoute.includes(route);
  }

  cambiarTab(tab: string) {
    this.tabChange.emit(tab);
  }

  logout() {
    this.auth.logout();
  }

  onClose() {
    this.closeSidebar.emit();
  }
}
