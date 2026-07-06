import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ApiService } from '@core/services/api.service';
import { AuthService } from '@core/services/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);

  ngOnInit() {
    this.api.cambios$.subscribe(data => {
      if (data.tipo === 'permisos') {
        this.auth.refrescarPermisos().subscribe();
      }
    });
    
    if (this.auth.getToken()) {
      this.auth.verifySession().subscribe();
    }
  }
}
