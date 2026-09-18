import { Injectable, NgZone } from '@angular/core';
import { ApiService } from '@core/services/api.service';
import { SwalService } from '@core/services/swal.service';

export interface ExcelPreviewRow {
  primer_nombre: string;
  segundo_nombre: string;
  primer_apellido: string;
  segundo_apellido: string;
  cedula: string;
  rol: string;
  telefono: string;
  sede: string;
  email: string;
  [key: string]: unknown;
}

export interface ImportResult {
  importados: number;
  omitidos: number;
  errores: number;
  mensaje: string;
}

@Injectable({ providedIn: 'root' })
export class AdminExcelImportService {
  private readonly HEADER_MAP: Record<string, string[]> = {
    primer_nombre: ['primer nombre', 'primer_nombre', 'primernombre'],
    segundo_nombre: ['segundo nombre', 'segundo_nombre', 'segundonombre'],
    primer_apellido: ['primer apellido', 'primer_apellido', 'primerapellido'],
    segundo_apellido: ['segundo apellido', 'segundo_apellido', 'segundoapellido'],
    cedula: ['cedula', 'cédula', 'dni', 'identificación', 'documento'],
    rol: ['rol', 'cargo', 'puesto', 'rol usuario'],
    telefono: ['telefono', 'teléfono', 'tel', 'celular', 'contacto'],
    sede: ['sede', 'sucursalmacen', 'id_sede', 'sede id'],
    email: ['correo', 'email', 'e-mail', 'mail', 'correo electronico', 'correo electrónico'],
  };

  constructor(private zone: NgZone, private api: ApiService, private swal: SwalService) {}

  parseExcelFile(file: File): Promise<ExcelPreviewRow[]> {
    return import('xlsx').then(XLSX => {
      return new Promise<ExcelPreviewRow[]>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rowsRaw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

            if (rowsRaw.length === 0) {
              reject(new Error('El archivo Excel está vacío'));
              return;
            }

            const actualHeaders = Object.keys(rowsRaw[0]).map(h =>
              h.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            );

            const missing = Object.keys(this.HEADER_MAP).filter(standardKey => {
              const synonyms = this.HEADER_MAP[standardKey];
              return !actualHeaders.some(h => synonyms.includes(h));
            });

            if (missing.length > 0) {
              reject(new Error('Al archivo Excel le faltan columnas requeridas'));
              return;
            }

            const normalizedRows: ExcelPreviewRow[] = rowsRaw.map(row => {
              const normalizedRow: any = {};
              Object.entries(this.HEADER_MAP).forEach(([standardKey, synonyms]) => {
                const foundHeader = Object.keys(row).find(h => {
                  const normalizedH = h.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                  return synonyms.includes(normalizedH);
                });
                normalizedRow[standardKey] = foundHeader ? row[foundHeader] : '';
              });
              return normalizedRow;
            });

            resolve(normalizedRows);
          } catch (err) {
            reject(err);
          }
        };
        reader.readAsArrayBuffer(file);
      });
    });
  }

  prepareForImport(rows: ExcelPreviewRow[], getSedeIdByName: (name: string) => number | null): { rows: Record<string, unknown>[]; rol: string } {
    const mappedData = rows.map(row => {
      const mappedRow: Record<string, unknown> = { ...row };
      const cedulaLimpia = (row.cedula || '').toString().replace(/\D/g, '');
      mappedRow['username'] = cedulaLimpia;
      mappedRow['password'] = cedulaLimpia;
      mappedRow['cedula'] = cedulaLimpia;
      if (mappedRow['primer_nombre']) mappedRow['primer_nombre'] = String(mappedRow['primer_nombre']).toUpperCase().trim();
      if (mappedRow['segundo_nombre']) mappedRow['segundo_nombre'] = String(mappedRow['segundo_nombre']).toUpperCase().trim();
      if (mappedRow['primer_apellido']) mappedRow['primer_apellido'] = String(mappedRow['primer_apellido']).toUpperCase().trim();
      if (mappedRow['segundo_apellido']) mappedRow['segundo_apellido'] = String(mappedRow['segundo_apellido']).toUpperCase().trim();
      if (mappedRow['telefono']) mappedRow['telefono'] = String(mappedRow['telefono']).replace(/\D/g, '');
      if (row.sede !== undefined && row.sede !== null && row.sede !== '') {
        const sedeId = getSedeIdByName(row.sede);
        if (sedeId) mappedRow['id_sede'] = sedeId;
      }
      mappedRow['activo'] = true;
      return mappedRow;
    });
    const rol = (mappedData[0]?.['rol'] as string) || 'medico';
    return { rows: mappedData, rol };
  }

  sendImport(body: { rows: Record<string, unknown>[]; rol: string }): Promise<ImportResult> {
    return new Promise((resolve, reject) => {
      this.api.importarPersonal(body).subscribe({
        next: (res: any) => resolve(res),
        error: (err) => reject(err),
      });
    });
  }
}
