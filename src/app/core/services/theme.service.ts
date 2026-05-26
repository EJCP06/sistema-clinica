import { Injectable, signal, effect } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  isDarkMode = signal<boolean>(
    sessionStorage.getItem('theme') === 'dark' || 
    (!sessionStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)
  );

  constructor() {
    effect(() => {
      const isDark = this.isDarkMode();
      const hasDarkClass = document.documentElement.classList.contains('dark');
      
      if (isDark && !hasDarkClass) {
        document.documentElement.classList.add('dark');
      } else if (!isDark && hasDarkClass) {
        document.documentElement.classList.remove('dark');
      }
      
      sessionStorage.setItem('theme', isDark ? 'dark' : 'light');
    });
  }

  toggleTheme() {
    this.isDarkMode.update(v => !v);
  }

  setTheme(isDark: boolean) {
    this.isDarkMode.set(isDark);
  }
}
