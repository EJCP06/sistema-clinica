import { Injectable } from '@angular/core';
import { jsPDF } from 'jspdf';
import autoTable, { UserOptions } from 'jspdf-autotable';

@Injectable({
  providedIn: 'root'
})
export class PdfService {

  constructor() { }

  /**
   * Genera un reporte PDF con logo, título y tabla de datos.
   * @param title Título del reporte
   * @param columns Cabeceras de la tabla
   * @param body Datos de la tabla
   * @param fileName Nombre del archivo generado
   */
  async generateReport(
    title: string,
    columns: string[],
    body: any[][],
    fileName: string = 'reporte.pdf'
  ) {
    const doc = new jsPDF();
    const logoUrl = 'assets/logo-cnc.png'; // Asegúrate de que el logo esté aquí o en public/

    // 1. Añadir Logo
    try {
      doc.addImage(logoUrl, 'PNG', 15, 10, 30, 20); // x, y, ancho, alto
    } catch (e) {
      console.warn('Logo no encontrado o error al cargar:', e);
    }

    // 2. Título
    doc.setFontSize(18);
    doc.text(title, 50, 20);
    
    doc.setFontSize(10);
    doc.text(`Fecha de generación: ${new Date().toLocaleDateString()}`, 50, 28);

    // 3. Tabla
    autoTable(doc, {
      startY: 40,
      head: [columns],
      body: body,
      theme: 'striped',
      headStyles: { fillColor: [41, 128, 185] }, // Azul corporativo
      margin: { top: 35 }
    });

    // 4. Guardar
    doc.save(fileName);
  }
}
