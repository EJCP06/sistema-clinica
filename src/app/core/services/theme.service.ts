import { Injectable, signal, effect } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  // Estado reactivo del tema con detección inicial robusta
  isDarkMode = signal<boolean>(
    localStorage.getItem('theme') === 'dark' || 
    (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)
  );

  constructor() {
    // Sincronizar automáticamente el estado con el DOM usando un efecto
    effect(() => {
      const isDark = this.isDarkMode();
      const hasDarkClass = document.documentElement.classList.contains('dark');
      
      if (isDark && !hasDarkClass) {
        document.documentElement.classList.add('dark');
      } else if (!isDark && hasDarkClass) {
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
