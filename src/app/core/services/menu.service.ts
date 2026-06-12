import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';
import { VISTA_POR_PERMISO, PERMISOS_POR_MODULO, MODULO_LABELS, MODULO_ICONS, VistaConfig } from '../config/permisos.config';
import { LucideIconData, LayoutDashboard, ClipboardList, Settings } from 'lucide-angular';

export interface MenuItem extends VistaConfig {
  expanded?: boolean;
}

export interface MenuSection {
  key: string;
  label: string;
  icon: LucideIconData;
  items: MenuItem[];
  expanded: boolean;
}

@Injectable({ providedIn: 'root' })
export class MenuService {
  private auth = inject(AuthService);

  getMenuSections(): MenuSection[] {
    const sections: MenuSection[] = [];

    for (const [moduloKey, permisos] of Object.entries(PERMISOS_POR_MODULO)) {
      const items = (permisos as string[])
        .filter((p: string) => this.auth.tienePermiso(p))
        .map((p: string) => VISTA_POR_PERMISO[p])
        .filter((v): v is VistaConfig => v !== undefined)
        .sort((a, b) => a.orden - b.orden);

      if (items.length > 0) {
        sections.push({
          key: moduloKey,
          label: MODULO_LABELS[moduloKey] || moduloKey.toUpperCase(),
          icon: this.getModuloIcon(moduloKey),
          items,
          expanded: false,
        });
      }
    }

    return sections;
  }

  getModuloIcon(moduloKey: string): LucideIconData {
    switch (moduloKey) {
      case 'panel': return LayoutDashboard;
      case 'operaciones': return ClipboardList;
      case 'admin': return Settings;
      default: return LayoutDashboard;
    }
  }

  tieneAccesoModulo(moduloKey: string): boolean {
    const permisos = (PERMISOS_POR_MODULO as Record<string, string[]>)[moduloKey];
    if (!permisos) return false;
    return permisos.some((p: string) => this.auth.tienePermiso(p));
  }
}