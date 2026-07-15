import { Component, inject, OnInit, OnDestroy, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '@core/services/api.service';
import { AuthService } from '@core/services/auth.service';
import { ReporteDiarioDTO, SedeDTO } from '@core/models/dto.models';
import {
  LucideAngularModule,
  LayoutDashboard,
  Settings,
  Users,
  XCircle,
  Clock,
  Activity,
  Download,
  Plus,
  ChevronDown,
  ChevronUp,
  Stethoscope,
  Search,
  CheckCircle2,
  LayoutGrid,
  ShieldCheck,
  Calendar,
  Menu,
  MapPin,
  Layers,
} from 'lucide-angular';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PaginationComponent } from '../../shared/components/pagination/pagination';
import { PaginatePipe } from '../../shared/pipes/paginate.pipe';
import { FillersPipe } from '../../shared/pipes/fillers.pipe';

@Component({
  selector: 'app-admin-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, PaginationComponent, PaginatePipe, FillersPipe],
  templateUrl: './admin-reports.html',
  styles: [],
})
/**
 * Panel de reportes operativos de la clínica.
 * Genera reportes diarios con estadísticas, KPIs y desglose por servicio,
 * con exportación a PDF.
 */
export class AdminReports implements OnInit, OnDestroy {
  readonly LayoutDashboard = LayoutDashboard;
  readonly Settings = Settings;
  readonly Users = Users;
  readonly XCircle = XCircle;
  readonly Clock = Clock;
  readonly Activity = Activity;
  readonly Download = Download;
  readonly Plus = Plus;
  readonly ChevronDown = ChevronDown;
  readonly ChevronUp = ChevronUp;
  readonly Stethoscope = Stethoscope;
  readonly Search = Search;
  readonly CheckCircle2 = CheckCircle2;
  readonly LayoutGrid = LayoutGrid;
  readonly ShieldCheck = ShieldCheck;
  readonly Calendar = Calendar;
  readonly Menu = Menu;
  readonly MapPin = MapPin;
  readonly Layers = Layers;

  private apiService = inject(ApiService);
  private authService = inject(AuthService);
  private destroyRef = inject(DestroyRef);

  pageSize = 6;
  currentPage = 1;

  turnos: ReporteDiarioDTO['turnos'] = [];
  turnosOriginal: ReporteDiarioDTO['turnos'] = [];
  sedes: SedeDTO[] = [];
  fechaDesde: string = new Date().toISOString().split('T')[0];
  fechaHasta: string = new Date().toISOString().split('T')[0];
  totalHoy = 0;
  totalAtendidos = 0;
  totalAusentes = 0;
  totalEnEspera = 0;
  totalEnAtencion = 0;
  totalRegistrados = 0;
  tiempoPromedioEspera = 0;
  tiempoPromedioAtencion = 0;
  ausentismoPorcentaje = 0;
  porServicio: ReporteDiarioDTO['por_servicio'] = [];
  ausentesList: ReporteDiarioDTO['ausentes'] = [];

  ngOnInit() {
    this.cargarReporte();
    this.apiService.getSedes().subscribe(sedes => this.sedes = sedes);
    this.apiService.cambios$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (this.esRangoHoy()) {
        this.cargarReporte();
      }
    });
  }

  esRangoHoy(): boolean {
    const hoy = new Date().toISOString().split('T')[0];
    return this.fechaDesde === hoy && this.fechaHasta === hoy;
  }

  get tituloActividad(): string {
    if (this.esRangoHoy()) return 'Actividad Reciente';
    const fmt = (f: string) => new Date(f + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
    return this.fechaDesde === this.fechaHasta
      ? `Actividad del ${fmt(this.fechaDesde)}`
      : `Actividad del ${fmt(this.fechaDesde)} al ${fmt(this.fechaHasta)}`;
  }

  restaurarHoy() {
    const hoy = new Date().toISOString().split('T')[0];
    this.fechaDesde = hoy;
    this.fechaHasta = hoy;
    this.cargarReporte();
  }

  ngOnDestroy() {}

  cargarReporte() {
    this.apiService.getReporteDiario(this.fechaDesde, this.fechaHasta).subscribe({
      next: (rep: ReporteDiarioDTO) => {
        console.log('Reporte diario recibido:', rep);
        this.turnosOriginal = rep.turnos ?? [];
        this.turnos = this.esRangoHoy()
          ? (rep.turnos ?? []).filter(t => t.estado?.toUpperCase() !== 'ATENDIDO')
          : (rep.turnos ?? []);
        this.currentPage = 1;
        this.totalHoy = rep.total ?? 0;
        this.totalAtendidos = rep.estadisticas?.atendidos ?? 0;
        this.totalAusentes = rep.estadisticas?.ausentes ?? 0;
        this.totalEnEspera = rep.estadisticas?.en_espera ?? 0;
        this.totalEnAtencion = rep.estadisticas?.en_atencion ?? 0;
        this.totalRegistrados = rep.estadisticas?.registrados ?? 0;
        this.tiempoPromedioEspera = rep.kpis?.tiempo_promedio_espera_min ?? 0;
        this.tiempoPromedioAtencion = rep.kpis?.tiempo_promedio_atencion_min ?? 0;
        this.ausentismoPorcentaje = rep.kpis?.ausentismo_porcentaje ?? 0;
        this.porServicio = rep.por_servicio ?? [];
        this.ausentesList = rep.ausentes ?? [];
      },
      error: (err) => {
        console.error('Error al cargar reporte:', err);
      },
    });
  }




  exportarPDF() {
    const doc = new jsPDF('portrait');
    const ahora = new Date();
    const fechaGeneracion = ahora.toLocaleDateString('es-AR', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
    const hora = ahora.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: true });

    const fmtFecha = (f: string) =>
      new Date(f + 'T12:00:00').toLocaleDateString('es-AR', {
        year: 'numeric', month: 'long', day: 'numeric'
      });
    const fechaTitulo = this.fechaDesde === this.fechaHasta
      ? fmtFecha(this.fechaDesde)
      : `${fmtFecha(this.fechaDesde)} al ${fmtFecha(this.fechaHasta)}`;

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;
    const tableWidth = pageWidth - margin * 2;

    try {
      doc.addImage('logo-cnc.png', 'PNG', margin, 8, 32, 24);
    } catch (_) {}
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('CLINICA NUEVA CARACAS', pageWidth / 2, 18, { align: 'center' });
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const usuario = this.authService.usuarioActual;
    const nombreUsuario = usuario
      ? `${usuario.nombre} ${usuario.apellido || ''}`.trim()
      : 'Desconocido';
    const sede = this.sedes.find(s => s.id_sede === usuario?.id_sede);
    const nombreSede = sede ? sede.nombre : 'Sin Sede';
    doc.text(`Generado: ${fechaGeneracion} a las ${hora}  |  Por: ${nombreUsuario}  |  Sede: ${nombreSede}`, pageWidth / 2, 26, { align: 'center' });

    const sortedTurnos = [...(this.turnosOriginal ?? [])].sort((a, b) => {
      const numA = parseInt((a.numero || String(a.id)).replace(/[^0-9]/g, ''), 10) || 0;
      const numB = parseInt((b.numero || String(b.id)).replace(/[^0-9]/g, ''), 10) || 0;
      return numA - numB;
    });

    const fmtTime = (val: string | null | undefined) =>
      val ? new Date(val).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: true }) : '';
    const fmtSalida = (val: string | null | undefined) =>
      val ? new Date(val).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: true }) : 'Sin atender';

    const sharedStyles = {
      theme: 'grid' as const,
      headStyles: { fillColor: [37, 99, 235] as [number, number, number], textColor: 255 as const, fontStyle: 'bold' as const, fontSize: 8 as const, halign: 'center' as const },
      bodyStyles: { fontSize: 8 as const, halign: 'center' as const },
      margin: { left: margin, right: margin } as const,
    };

    let startY = 42;
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    doc.text('Reporte de Operaciones', pageWidth / 2, startY, { align: 'center' });
    startY += 8;
    doc.setFontSize(10);
    doc.text(`Actividad del ${fechaTitulo}`, margin, startY);
    startY += 5;

    const turnosData = sortedTurnos.map(t => [
      t.numero || String(t.id),
      `${t.paciente?.nombre || ''} ${t.paciente?.apellido || ''}`.trim(),
      t.paciente?.documento || '',
      t.estado || '',
      t.servicio_nombre || '',
      fmtTime(t.hora_llegada),
      fmtSalida(t.hora_fin_atencion),
    ]);

    if (turnosData.length > 0) {
      autoTable(doc, {
        ...sharedStyles,
        startY,
        head: [['Turno', 'Paciente', 'Cédula', 'Estado', 'Servicio', 'Hora de Llegada', 'Hora de Salida']],
        body: turnosData,
        columnStyles: {
          0: { cellWidth: tableWidth / 7 },
          1: { cellWidth: tableWidth / 7 },
          2: { cellWidth: tableWidth / 7 },
          3: { cellWidth: tableWidth / 7 },
          4: { cellWidth: tableWidth / 7 },
          5: { cellWidth: tableWidth / 7 },
          6: { cellWidth: tableWidth / 7 },
        },
      });
    } else {
      doc.setFontSize(9);
      doc.setTextColor(150, 150, 150);
      doc.setFont('helvetica', 'italic');
      const noDataMsg = this.fechaDesde === this.fechaHasta
        ? `No se han registrado atenciones el ${fechaTitulo}.`
        : `No se han registrado atenciones en el período seleccionado.`;
      doc.text(noDataMsg, margin, startY + 10);
    }

    const lastTableHeight = (doc as any).lastAutoTable?.finalY || startY + 10;
    let currentY = lastTableHeight + 12;

    if (this.porServicio.length > 0) {
      if (currentY > 250) {
        doc.addPage();
        currentY = 20;
      }
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 30, 30);
      doc.text('Desglose por Servicio', margin, currentY);
      currentY += 5;

      const servData = this.porServicio.map(s => [
        s.servicio,
        String(s.total),
        String(s.atendidos),
        String(s.ausentes),
      ]);

      autoTable(doc, {
        ...sharedStyles,
        startY: currentY,
        head: [['Servicio', 'Total', 'Atendidos', 'Ausentes']],
        body: servData,
        columnStyles: {
          0: { cellWidth: tableWidth * 0.40 },
          1: { cellWidth: tableWidth * 0.20 },
          2: { cellWidth: tableWidth * 0.20 },
          3: { cellWidth: tableWidth * 0.20 },
        },
      });
    }

    const nombreArchivo = this.fechaDesde === this.fechaHasta
      ? `reporte-diario-${this.fechaDesde}.pdf`
      : `reporte-diario-${this.fechaDesde}_al_${this.fechaHasta}.pdf`;
    doc.save(nombreArchivo);
  }

  trackById = (index: number, item: any) => item?.id ?? item?.id_atencion ?? item?.id_consultorio ?? item?.id_especialidad ?? item?.id_sede ?? index;
}
