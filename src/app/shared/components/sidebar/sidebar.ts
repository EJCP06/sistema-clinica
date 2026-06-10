import { Component, Input, Output, EventEmitter, inject, OnInit } from '@angular/core';
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
  User,
  Activity,
  DoorOpen,
  ChevronDown,
  Ticket,
  Sun,
  Moon,
  ClipboardList,
  FlaskConical,
  Image,
  Megaphone
} from 'lucide-angular';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, LucideAngularModule],
  templateUrl: './sidebar.html',
  styleUrls: []
})
export class Sidebar implements OnInit {
  @Input() activeTab: string = '';
  @Input() sidebarOpen: boolean = true;
  @Output() tabChange = new EventEmitter<string>();
  @Output() closeSidebar = new EventEmitter<void>();

  private auth = inject(AuthService);
  private themeService = inject(ThemeService);
  private router = inject(Router);
  
  // Loading state for logout
  cargando = false;
  initialTransitionDisabled = true;

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
  readonly User = User;
  readonly DoorOpen = DoorOpen;
  readonly ChevronDown = ChevronDown;
  readonly Ticket = Ticket;
  readonly Sun = Sun;
  readonly Moon = Moon;
  readonly ClipboardList = ClipboardList;
  readonly FlaskConical = FlaskConical;
  readonly Image = Image;
  readonly Megaphone = Megaphone;

  // Collapsible states (persistidos en sessionStorage)
  get expandedPanel() { return sessionStorage.getItem('sb_panel') === '1'; }
  set expandedPanel(v: boolean) { sessionStorage.setItem('sb_panel', v ? '1' : '0'); }

  get expandedOperaciones() { return sessionStorage.getItem('sb_operaciones') === '1'; }
  set expandedOperaciones(v: boolean) { sessionStorage.setItem('sb_operaciones', v ? '1' : '0'); }

  get expandedAdmin() { return sessionStorage.getItem('sb_admin') === '1'; }
  set expandedAdmin(v: boolean) { sessionStorage.setItem('sb_admin', v ? '1' : '0'); }

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

  navigate(route: string, queryParams?: any) {
    if (route === 'admin' && typeof queryParams === 'string') {
      this.router.navigate(['/administrador'], { queryParams: { tab: queryParams } });
    } else if (queryParams) {
      this.router.navigate([`/${route}`], { queryParams: queryParams });
    } else {
      this.router.navigate([`/${route}`]);
    }
    // Auto-close sidebar on mobile after navigation
    this.closeSidebar.emit();
  }

  isActive(route: string, tab?: string): boolean {
    const currentRoute = this.router.url.split('?')[0];
    if (tab) {
      return currentRoute === `/${route}` && this.router.url.includes(`tab=${tab}`);
    }
    return currentRoute === `/${route}`;
  }

  cambiarTab(tab: string) {
    this.tabChange.emit(tab);
  }

  ngOnInit() {
    // Deshabilitar la transición inicial para evitar el efecto de "recarga" del toggle
    setTimeout(() => this.initialTransitionDisabled = false, 100);
  }

  logout() {
    this.cargando = true;
    setTimeout(() => {
      this.auth.logout();
    }, 800);
  }

  onClose() {
    this.closeSidebar.emit();
  }
}
