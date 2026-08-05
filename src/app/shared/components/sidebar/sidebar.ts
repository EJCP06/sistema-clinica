import { Component, Input, Output, EventEmitter, inject, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
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
  Megaphone,
  Key
} from 'lucide-angular';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, LucideAngularModule],
  templateUrl: './sidebar.html',
  styleUrls: []
})
/**
 * Barra lateral de navegación.
 * Muestra el menú contextual según el rol del usuario,
 * controla el tema oscuro/claro y gestiona el cierre de sesión.
 */
export class Sidebar implements OnInit, OnDestroy {
  @Input() activeTab: string = '';
  @Input() sidebarOpen: boolean = true;
  @Output() tabChange = new EventEmitter<string>();
  @Output() closeSidebar = new EventEmitter<void>();

  private auth = inject(AuthService);
  private themeService = inject(ThemeService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private usuarioSub?: Subscription;
  
  cargando = false;
  initialTransitionDisabled = true;

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
  readonly Key = Key;

  get expandedPanel() { return sessionStorage.getItem('sb_panel') === '1'; }
  set expandedPanel(v: boolean) { sessionStorage.setItem('sb_panel', v ? '1' : '0'); }

  get expandedOperaciones() { return sessionStorage.getItem('sb_operaciones') === '1'; }
  set expandedOperaciones(v: boolean) { sessionStorage.setItem('sb_operaciones', v ? '1' : '0'); }

  get expandedAdmin() { return sessionStorage.getItem('sb_admin') === '1'; }
  set expandedAdmin(v: boolean) { sessionStorage.setItem('sb_admin', v ? '1' : '0'); }

  toggleSection(section: string) {
    const isAlreadyOpen =
      (section === 'panel' && this.expandedPanel) ||
      (section === 'operaciones' && this.expandedOperaciones) ||
      (section === 'admin' && this.expandedAdmin);

    this.expandedPanel = false;
    this.expandedOperaciones = false;
    this.expandedAdmin = false;

    if (!isAlreadyOpen) {
      if (section === 'panel') this.expandedPanel = true;
      if (section === 'operaciones') this.expandedOperaciones = true;
      if (section === 'admin') this.expandedAdmin = true;
    }
  }

  get usuario() {
    return this.auth.usuarioActual;
  }

  get rol() {
    return this.usuario?.rol || '';
  }

  get esCoordinador() {
    return this.rol === 'coordinador';
  }

  tienePermiso(permiso: string): boolean {
    return this.auth.tienePermiso(permiso);
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
    setTimeout(() => this.initialTransitionDisabled = false, 100);
    this.usuarioSub = this.auth.usuario$.subscribe(() => {
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy() {
    this.usuarioSub?.unsubscribe();
  }

  logout() {
    this.cargando = true;
    this.cdr.detectChanges();
    const MIN_CARGANDO = 800;

    setTimeout(() => {
      this.auth.clearSession();
      this.router.navigate(['/login']);
      this.cargando = false;
    }, MIN_CARGANDO);
  }

  onClose() {
    this.closeSidebar.emit();
  }
}
