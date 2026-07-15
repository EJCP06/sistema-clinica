import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@core/services/auth.service';

@Component({
  selector: 'app-inicio',
  standalone: true,
  template: '',
})
/** Componente de inicio que redirige al usuario según su rol/permisos. */
export class Inicio implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);

  ngOnInit(): void {
    const ruta = this.auth.obtenerRutaInicial();
    void this.router.navigateByUrl(ruta, { replaceUrl: true });
  }
}