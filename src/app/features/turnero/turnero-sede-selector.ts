import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { LucideAngularModule, Building2, ArrowLeft } from 'lucide-angular';
import { desbloquearVozNavegador } from './voz.util';

@Component({
  selector: 'app-turnero-sede-selector',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div class="h-[100dvh] bg-slate-900 text-white flex flex-col items-center justify-center gap-8 p-8 relative">
      <button (click)="volver()"
        class="absolute top-6 left-6 flex items-center justify-center w-10 h-10 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all duration-200">
        <lucide-icon [img]="ArrowLeft" class="w-5 h-5"></lucide-icon>
      </button>
      <img src="/logo-cnc.png" alt="Logo" class="w-20 h-20 rounded-xl bg-white/10 p-2 object-contain" />
      <h1 class="text-3xl md:text-5xl font-black tracking-tight text-center">SELECCIONE LA SEDE</h1>
      <p class="text-slate-400 text-lg">¿De qué sede desea ver el turnero?</p>
      <div class="flex flex-col md:flex-row gap-6 mt-4">
        <button (click)="ir(1)"
          class="flex items-center gap-4 px-10 py-8 bg-slate-800 hover:bg-blue-700 rounded-2xl border-2 border-slate-700 hover:border-blue-500 transition-all duration-200 text-left">
          <lucide-icon [img]="Building2" class="w-10 h-10 text-blue-400 shrink-0"></lucide-icon>
          <div class="text-2xl font-black">Plaza Sucre</div>
        </button>
        <button (click)="ir(2)"
          class="flex items-center gap-4 px-10 py-8 bg-slate-800 hover:bg-blue-700 rounded-2xl border-2 border-slate-700 hover:border-blue-500 transition-all duration-200 text-left">
          <lucide-icon [img]="Building2" class="w-10 h-10 text-emerald-400 shrink-0"></lucide-icon>
          <div class="text-2xl font-black">Santa Mónica</div>
        </button>
      </div>
    </div>
  `
})
/** Selector de sede para el tablero turnero público. */
export class TurneroSedeSelector {
  readonly Building2 = Building2;
  readonly ArrowLeft = ArrowLeft;
  private router = inject(Router);

  ir(sede: number) {
    sessionStorage.setItem('turnero_sede', String(sede));
    // El click para elegir sede es un gesto de usuario: desbloquea el audio
    // para que el turnero pueda anunciar los llamados por voz.
    sessionStorage.setItem('turnero_audio_unlocked', 'true');
    desbloquearVozNavegador();
    this.router.navigate(['/turnero', sede], { queryParams: { sala: 'aps' } });
  }

  volver() {
    this.router.navigate(['/login']);
  }
}
