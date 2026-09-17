import { Injectable, inject, ChangeDetectorRef } from '@angular/core';
import { ApiService } from '../../core/services/api.service';
import { SwalService } from '../../core/services/swal.service';

@Injectable({ providedIn: 'root' })
export class RecepcionAseguradoraService {
  private api = inject(ApiService);
  private swal = inject(SwalService);

  aseguradoras: any[] = [];
  showPreviewModal = false;
  previewData: any[] = [];
  showExcelFormat = false;
  isImporting = false;

  cargarAseguradoras(cdr: ChangeDetectorRef, onDone?: () => void) {
    this.api.getAseguradoras().subscribe({
      next: (d: any[]) => { this.aseguradoras = d; cdr.detectChanges(); onDone?.(); },
      error: (e: any) => { console.error('Error cargando aseguradoras:', e); onDone?.(); },
    });
  }

  confirmarImportacion(state: { isSaving: boolean }, onReload: () => void) {
    if (state.isSaving) return;
    state.isSaving = true;
    const inicio = Date.now();
    this.api.importarAseguradoras({ rows: this.previewData }).subscribe({
      next: (res: any) => { setTimeout(() => { onReload(); this.swal.success(res.mensaje || `Importacion exitosa: ${res.importados || this.previewData.length} registros`); this.showPreviewModal = false; this.previewData = []; state.isSaving = false; }, Math.max(0, 800 - (Date.now() - inicio))); },
      error: (e: any) => { setTimeout(() => { this.swal.error(e.error?.mensaje || 'Error al importar datos'); state.isSaving = false; }, Math.max(0, 800 - (Date.now() - inicio))); },
    });
  }

  importarAseguradorasExcel(fileInput: HTMLInputElement) {
    const file = fileInput?.files?.[0]; if (!file) return;
    this.showExcelFormat = false; this.isImporting = true;
    import('xlsx').then((XLSX) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const wb = XLSX.read(data, { type: 'array' });
          const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
          if (!rows.length) { this.isImporting = false; this.swal.error('El archivo Excel esta vacio'); return; }
          const hMap: Record<string, string[]> = { nombre: ['nombre de la aseguradora', 'nombre de aseguradora', 'nombre aseguradora', 'nombre', 'aseguradora'], tipo: ['tipo', 'type'] };
          const actual = Object.keys(rows[0]).map(h => h.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
          if (Object.keys(hMap).some(k => !hMap[k].some(s => actual.includes(s)))) { this.isImporting = false; this.swal.error('Al archivo Excel le faltan columnas requeridas'); return; }
          this.previewData = rows.map(row => { const nr: any = {}; Object.entries(hMap).forEach(([k, syn]) => { const fh = Object.keys(row).find(h => syn.includes(h.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, ''))); nr[k] = fh ? row[fh] : ''; }); return nr; });
          this.isImporting = false; this.showPreviewModal = true;
        } catch (err) { this.isImporting = false; this.swal.error('Error al leer el archivo Excel'); console.error(err); }
      };
      reader.readAsArrayBuffer(file);
    }).catch(() => { this.isImporting = false; this.swal.error('Error al cargar el lector de Excel'); });
    fileInput.value = '';
  }

  procesarAseguradora(nuevoPaciente: any, isEditMode: boolean, state: { isSaving: boolean; mostrarRegistro: boolean }, onReload: () => void, finalizarCb: (fn?: () => void) => void) {
    const nombre = (nuevoPaciente.nombre || '').toString().trim();
    if (!nombre) { this.swal.warning('Debe ingresar el nombre de la aseguradora'); return; }
    state.isSaving = true;
    const inicio = Date.now();
    const ok = (fn?: () => void) => setTimeout(() => { fn?.(); }, Math.max(0, 800 - (Date.now() - inicio)));
    if (isEditMode && nuevoPaciente.id_cliente) {
      this.api.put(`admin/aseguradoras/${nuevoPaciente.id_cliente}`, { nombre }).subscribe({ next: () => finalizarCb(() => { onReload(); state.mostrarRegistro = false; this.swal.success('Aseguradora actualizada correctamente'); }), error: () => finalizarCb(() => this.swal.error('Error al actualizar aseguradora')) });
    } else {
      this.api.crearAseguradora({ nombre }).subscribe({ next: () => finalizarCb(() => { onReload(); state.mostrarRegistro = false; this.swal.success('Aseguradora registrada correctamente'); }), error: () => finalizarCb(() => this.swal.error('Error al registrar aseguradora')) });
    }
  }

  async eliminarAseguradora(fila: any, onReload: () => void) {
    const r = await this.swal.confirmDelete(`Eliminar aseguradora ${fila.aseguradora}?`);
    if (!r.isConfirmed) return;
    this.api.delete(`admin/aseguradoras/${fila.id_cliente}`).subscribe({ next: () => { onReload(); this.swal.success('Aseguradora eliminada correctamente'); }, error: () => this.swal.error('Error al eliminar') });
  }
}
