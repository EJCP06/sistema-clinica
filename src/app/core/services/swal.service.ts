import { Injectable } from '@angular/core';
import Swal from 'sweetalert2';

@Injectable({ providedIn: 'root' })
export class SwalService {

  private toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    didOpen: (toast) => {
      toast.onmouseenter = Swal.stopTimer;
      toast.onmouseleave = Swal.resumeTimer;
    }
  });

  success(message: string, title?: string) {
    return this.toast.fire({ icon: 'success', title: message });
  }

  error(message: string, title?: string) {
    return this.toast.fire({ icon: 'error', title: message });
  }

  warning(message: string, title?: string) {
    return this.toast.fire({ icon: 'warning', title: message });
  }

  info(message: string, title?: string) {
    return this.toast.fire({ icon: 'info', title: message });
  }

  confirm(message: string, title?: string) {
    return Swal.fire({
      title: title || '¿Estás seguro?',
      text: message,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#2563eb',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí',
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
    });
  }

  confirmDelete(message?: string) {
    return Swal.fire({
      title: '¿Eliminar?',
      text: message || 'Esta acción no se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
    });
  }

  loading(title?: string) {
    return Swal.fire({
      title: title || 'Guardando...',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });
  }

  close() {
    Swal.close();
  }
}
