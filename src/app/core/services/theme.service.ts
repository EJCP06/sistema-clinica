import { Injectable, signal, effect } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  // Estado reactivo del tema
  isDarkMode = signal<boolean>(localStorage.getItem('theme') === 'dark');

  constructor() {
    // Sincronizar automáticamente el estado con el DOM usando un efecto
    effect(() => {
      const isDark = this.isDarkMode();
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
    });
  }

  toggleTheme() {
    this.isDarkMode.update(v => !v);
  }

  setTheme(isDark: boolean) {
    this.isDarkMode.set(isDark);
  }
}
