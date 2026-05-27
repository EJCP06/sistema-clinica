import { Component, inject, OnInit, OnDestroy, ViewChild, ElementRef, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '@core/services/api.service';
import { ReporteDiarioDTO } from '@core/models/dto.models';
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

@Component({
  selector: 'app-admin-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './admin-reports.html',
  styles: [],
})
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
  private destroyRef = inject(DestroyRef);

  turnos: ReporteDiarioDTO['turnos'] = [];
  totalHoy = 0;
  totalAtendidos = 0;
  totalAusentes = 0;
  totalEnEspera = 0;
  tiempoPromedioEspera = 0;
  tiempoPromedioAtencion = 0;

  ngOnInit() {
    this.cargarReporte();
    this.apiService.cambios$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.cargarReporte();
    });
  }

  ngOnDestroy() {}

  cargarReporte() {
    this.apiService.getReporteDiario().subscribe({
      next: (rep: ReporteDiarioDTO) => {
        console.log('Reporte diario recibido:', rep);
        this.turnos = rep.turnos ?? [];
        this.totalHoy = rep.total ?? 0;
        this.totalAtendidos = rep.estadisticas?.atendidos ?? 0;
        this.totalAusentes = rep.estadisticas?.ausentes ?? 0;
        this.totalEnEspera = rep.estadisticas?.en_espera ?? 0;
      },
      error: (err) => {
        console.error('Error al cargar reporte:', err);
      },
    });
  }




  exportarPDF() {
    const doc = new jsPDF();
    const fecha = new Date().toLocaleDateString('es-AR');
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, 210, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('CLÍNICA CENTRAL - Reporte Diario', 14, 12);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Fecha: ${fecha}`, 14, 22);
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumen de la Jornada', 14, 38);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Pacientes atendidos: ${this.totalAtendidos}`, 14, 48);
    doc.text(`Pacientes ausentes: ${this.totalAusentes}`, 14, 55);
    doc.text(`Tiempo promedio de espera: ${this.tiempoPromedioEspera} min`, 14, 62);
    doc.text(`Duración promedio de consulta: ${this.tiempoPromedioAtencion} min`, 14, 69);
    doc.save(`reporte-clinica-${fecha.replace(/\//g, '-')}.pdf`);
  }

  trackById = (index: number, item: any) => item?.id ?? item?.id_atencion ?? item?.id_consultorio ?? item?.id_especialidad ?? item?.id_sede ?? index;
}
