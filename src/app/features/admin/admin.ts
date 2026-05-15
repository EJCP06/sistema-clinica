import { Component, inject, OnInit, OnDestroy, ViewChild, ElementRef, HostListener, ChangeDetectorRef } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { ApiService } from '@core/services/api.service'
import { AuthService } from '@core/services/auth.service'
import { ThemeService } from '@core/services/theme.service'
import { Header } from '../../shared/components/header/header'
import { LucideAngularModule, LayoutDashboard, BarChart3, Settings, Users, XCircle, Clock, Activity, Download, LogOut, Plus, Trash2, ChevronDown, ChevronUp, Stethoscope, DoorOpen, UserCog, Search, Edit2, Eye, EyeOff, Menu, MapPin, Layers, CheckCircle2, LayoutGrid, ShieldCheck, Calendar, Sun, Moon } from 'lucide-angular'
import { Chart } from 'chart.js/auto'
import jsPDF from 'jspdf'

import { Sidebar } from '../../shared/components/sidebar/sidebar'

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, Sidebar, Header],
  templateUrl: './admin.html',
  styles: []
})
export class Admin implements OnInit, OnDestroy {
  // Lucide icons
  readonly LayoutDashboard = LayoutDashboard
  readonly BarChart3 = BarChart3
  readonly Settings = Settings
  readonly Users = Users
  readonly XCircle = XCircle
  readonly Clock = Clock
  readonly Activity = Activity
  readonly Download = Download
  readonly LogOut = LogOut
  readonly Plus = Plus
  readonly Trash2 = Trash2
  readonly ChevronDown = ChevronDown
  readonly ChevronUp = ChevronUp
  readonly Stethoscope = Stethoscope
  readonly DoorOpen = DoorOpen
  readonly UserCog = UserCog
  readonly Search = Search
  readonly Edit2 = Edit2
  readonly Eye = Eye
  readonly EyeOff = EyeOff
  readonly Menu = Menu
  readonly MapPin = MapPin
  readonly Layers = Layers
  readonly CheckCircle2 = CheckCircle2
  readonly LayoutGrid = LayoutGrid
  readonly ShieldCheck = ShieldCheck
  readonly Calendar = Calendar
  readonly Sun = Sun
  readonly Moon = Moon

  private apiService = inject(ApiService)
  private authService = inject(AuthService)
  private themeService = inject(ThemeService)
  private route = inject(ActivatedRoute)
  private cdr = inject(ChangeDetectorRef)

  usuario = this.authService.usuarioActual

  // Data lists
  especialidades: any[] = []
  consultorios: any[] = []
  medicos: any[] = []
  recepcionistas: any[] = []
  administradores: any[] = []
  turnos: any[] = []
  sedes: any[] = []

  // UI state
  activeTab: 'reports' | 'stats' | 'config' | 'personal' | 'especialidades' | 'medicos' | 'recepcionistas' | 'administradores' = 'reports'
  configExpanded = true

  get isDarkMode() { return this.themeService.isDarkMode() }
  set isDarkMode(val: boolean) { this.themeService.setTheme(val) }

  toggleDarkMode() {
    this.themeService.toggleTheme()
  }
  loadingStats = false
  errorStats: string | null = null
  fechaInicio = ''
  fechaFin = ''
  noDataStats = false

  // Modals state
  showModalPersonal = false
  showModalEspecialidad = false
  isEditing = false
  editingId: number | null = null
  isSaving = false
  showPassword = false
  sidebarOpen = false

  // Search
  searchQuery = ''
  searchFilter = 'all'

  // Custom Dropdowns
  showRolDropdown = false
   showMedicoEspDropdown = false
  showMedicoConDropdown = false
  showMedicoPisoDropdown = false
  showSedeDropdown = false
  showSearchFilterDropdown = false

  // Form Models
  formPersonal = {
    rol: 'medico',
    username: '',
    password: '',
    nombre: '',
    apellido: '',
    cedula: '',
    telefono: '',
    email: '',
    activo: true,
    servicio_id: '',
    consultorio_id: '',
    piso: '',
    id_sede: '' as string | number
  }

  formEsp = {
    nombre: '',
    codigo: '',
    prefijo: '',
    piso: '',
    consultorio: '',
    descripcion: '',
    activo: true,
    id_sede: '' as string | number
  }

  // Stats result
  estadisticasAvanzadas: any = null
  chartData: any = null
  maxValue = 0

  // Totals (UI)
  totalHoy = 0
  totalAtendidos = 0
  totalAusentes = 0
  totalEnEspera = 0
  tiempoPromedioEspera = 0
  tiempoPromedioAtencion = 0

  // Charts
  @ViewChild('servicioChart') servicioChartRef!: ElementRef<HTMLCanvasElement>
  @ViewChild('medicoChart') medicoChartRef!: ElementRef<HTMLCanvasElement>
  @ViewChild('tendenciaChart') tendenciaChartRef!: ElementRef<HTMLCanvasElement>
  @ViewChild('horaChart') horaChartRef!: ElementRef<HTMLCanvasElement>
  private charts: Chart[] = []

  ngOnInit() {
    // 1. Restaurar pestaña guardada (sobrevive F5)
    const savedTab = sessionStorage.getItem('admin_activeTab');
    if (savedTab) {
      this.activeTab = savedTab as any;
    }

    // 2. Escuchar cambios de URL del sidebar
    this.route.queryParams.subscribe(params => {
      if (params['tab']) {
        this.activeTab = params['tab'];
        this.searchQuery = '';
        sessionStorage.setItem('admin_activeTab', params['tab']);
      }
    });

    this.cargarSedes()
    this.cargarDatos()
  }

  cargarSedes() {
    this.apiService.getSedes().subscribe({
      next: s => {
        console.log('Sedes cargadas:', s);
        this.sedes = s;
        this.cdr.detectChanges();
      },
      error: err => {
        console.error('Error al cargar sedes:', err);
      }
    });
  }

  ngOnDestroy() {
    this.charts.forEach(c => c.destroy())
    this.charts = []
  }

  cargarDatos() {
    this.apiService.getServicios().subscribe(svs => { this.especialidades = svs; this.cdr.detectChanges(); })
    this.apiService.getConsultorios().subscribe(cons => { this.consultorios = cons; this.cdr.detectChanges(); })
    
    // Cargar Personal y dividirlo por roles
    this.apiService.getPersonal().subscribe(pers => {
      this.medicos = pers.filter((p: any) => p.rol === 'medico');
      this.recepcionistas = pers.filter((p: any) => p.rol === 'recepcionista');
      this.administradores = pers.filter((p: any) => p.rol === 'admin');
      this.cdr.detectChanges();
    })
    this.apiService.getReporteDiario().subscribe({
      next: (rep: any) => {
        this.turnos = rep.turnos || []
        this.totalHoy = rep.total ?? 0
        this.totalAtendidos = rep.estadisticas?.atendidos ?? 0
        this.totalAusentes = rep.estadisticas?.ausentes ?? 0
        this.totalEnEspera = rep.estadisticas?.en_espera ?? 0
        this.tiempoPromedioEspera = rep.promedios?.esperaMinutos ?? 0
        this.tiempoPromedioAtencion = rep.promedios?.atencionMinutos ?? 0
        this.cdr.detectChanges()
      },
      error: () => {}
    })
  }

  // --- Modal Logic ---
  openModalPersonal(user?: any, rol?: string) {
    this.showPassword = false
    this.isEditing = !!user
    this.editingId = user?.id || null

    if (user) {
      this.formPersonal = { 
        rol: user.rol || 'medico',
        username: user.username,
        password: '',
        nombre: user.nombre,
        apellido: user.apellido || '',
        cedula: user.cedula || '',
        telefono: user.telefono || '',
        email: user.email || '',
        activo: user.activo,
        servicio_id: user.servicio_id || '',
        consultorio_id: user.consultorio_id || '',
        piso: user.piso || '',
        id_sede: user.id_sede || ''
      }
    } else {
      this.formPersonal = { 
        rol: rol || 'medico',
        username: '', 
        password: '', 
        nombre: '', 
        apellido: '', 
        cedula: '', 
        telefono: '', 
        email: '', 
        activo: true, 
        servicio_id: '', 
        consultorio_id: '',
        piso: '',
        id_sede: ''
      }
    }
    this.showModalPersonal = true
  }

  openModalEsp(esp?: any) {
    if (esp) {
      this.isEditing = true
      this.editingId = esp.id
      this.formEsp = { 
        nombre: esp.nombre || '',
        codigo: esp.codigo || '',
        prefijo: esp.prefijo || '',
        piso: esp.piso || '',
        consultorio: esp.consultorio || '',
        descripcion: esp.descripcion || '',
        activo: esp.activo,
        id_sede: esp.id_sede || ''
      }
    } else {
      this.isEditing = false
      this.editingId = null
      this.formEsp = { nombre: '', codigo: '', prefijo: '', piso: '', consultorio: '', descripcion: '', activo: true, id_sede: '' }
    }
    this.showModalEspecialidad = true
  }


  // --- CRUD PERSONAL ---
  guardarPersonal() {
    if (this.isSaving) return

    this.isSaving = true
    
    // Sanitización y Formateo antes de enviar
    const rol = this.formPersonal.rol;
    const body = { 
      ...this.formPersonal,
      nombre: (this.formPersonal.nombre || '').toUpperCase().trim(),
      apellido: (this.formPersonal.apellido || '').toUpperCase().trim(),
      cedula: (this.formPersonal.cedula || '').toString().replace(/\D/g, ''),
      telefono: (this.formPersonal.telefono || '').toString().replace(/\D/g, ''),
      email: this.formPersonal.email ? this.formPersonal.email.toLowerCase().trim() : null,
      password: this.formPersonal.password ? this.formPersonal.password.replace(/\s/g, '') : null,
      piso: (rol === 'medico' || rol === 'recepcionista') && this.formPersonal.piso ? this.formPersonal.piso.toString().replace(/\D/g, '') : null,
      // Asegurar que id_sede sea un número válido, fallback al del usuario o a 1
      id_sede: this.formPersonal.id_sede ? Number(this.formPersonal.id_sede) : (this.usuario?.id_sede ? Number(this.usuario.id_sede) : 1),
      // Solo médicos usan consultorio y especialidad
      id_consultorio: rol === 'medico' ? (this.formPersonal.consultorio_id ? Number(this.formPersonal.consultorio_id) : null) : null,
      servicio_id: rol === 'medico' ? (this.formPersonal.servicio_id ? Number(this.formPersonal.servicio_id) : null) : null
    }

    const call = (this.isEditing && this.editingId !== null)
      ? this.apiService.actualizarPersonal(this.editingId, body)
      : this.apiService.crearPersonal(body)
    
    call.subscribe({
      next: () => {
        this.showModalPersonal = false
        this.isSaving = false
        this.cdr.detectChanges()
        this.cargarDatos()
      },
      error: () => {
        this.isSaving = false
        this.cdr.detectChanges()
        alert('Error al guardar personal')
      }
    })
  }

  eliminarPersonal(id: number) {
    if (confirm('¿Eliminar este usuario del personal?')) {
      this.apiService.eliminarPersonal(id).subscribe(() => this.cargarDatos())
    }
  }

  // --- CRUD ESPECIALIDADES ---
  guardarEsp() {
    if (this.isSaving) return

    this.isSaving = true
    
    // Formatear consultorios: "1, 2" -> "CONSULTORIO 1, CONSULTORIO 2"
    let consultorioFormateado = (this.formEsp.consultorio || '').toUpperCase().trim();
    if (consultorioFormateado) {
      consultorioFormateado = consultorioFormateado.split(',')
        .map(part => {
          const p = part.trim();
          if (!p) return '';
          return p.startsWith('CONSULTORIO') ? p : `CONSULTORIO ${p}`;
        })
        .filter(p => p)
        .join(', ');
    }

    const body = {
      nombre: (this.formEsp.nombre || '').toUpperCase().trim(),
      prefijo: (this.formEsp.prefijo || '').toUpperCase().trim(),
      piso: (this.formEsp.piso || '').toString().replace(/\D/g, ''),
      consultorio: consultorioFormateado,
      activo: this.formEsp.activo,
      id_sede: this.formEsp.id_sede ? Number(this.formEsp.id_sede) : (this.usuario?.id_sede ? Number(this.usuario.id_sede) : 1)
    }

    const call = (this.isEditing && this.editingId !== null)
      ? this.apiService.actualizarServicio(this.editingId, body)
      : this.apiService.crearServicio(body)

    call.subscribe({
      next: () => {
        this.showModalEspecialidad = false
        this.isSaving = false
        this.formEsp = { nombre: '', codigo: '', prefijo: '', piso: '', consultorio: '', descripcion: '', activo: true, id_sede: this.usuario?.id_sede || '' }
        this.cdr.detectChanges()
        this.apiService.getServicios().subscribe({
          next: svs => { this.especialidades = svs; this.cdr.detectChanges(); },
          error: err => console.warn('No se pudo recargar especialidades:', err)
        })
      },
      error: (err) => {
        console.error('Error al guardar especialidad:', err)
        this.showModalEspecialidad = false
        this.isSaving = false
        this.cdr.detectChanges()
        this.apiService.getServicios().subscribe({
          next: svs => { this.especialidades = svs; this.cdr.detectChanges(); },
          error: e => console.warn(e)
        })
      }
    })
  }

  eliminarEspecialidad(id: number) {
    if (confirm('¿Eliminar esta especialidad?')) {
      this.apiService.eliminarServicio(id).subscribe(() => this.cargarDatos())
    }
  }


  get medicosFiltrados() {
    return this.medicos.filter(m => {
      const query = this.searchQuery.toLowerCase()
      if (!query) return true
      
      const matchNombre = (m.nombre || '').toLowerCase().includes(query)
      const matchApellido = (m.apellido || '').toLowerCase().includes(query)
      const matchCedula = (m.cedula || '').toLowerCase().includes(query)
      const matchEsp = this.getNombreEsp(m.servicio_id).toLowerCase().includes(query)

      if (this.searchFilter === 'nombre') return matchNombre;
      if (this.searchFilter === 'apellido') return matchApellido;
      if (this.searchFilter === 'cedula') return matchCedula;
      if (this.searchFilter === 'especialidad') return matchEsp;
      
      return matchNombre || matchApellido || matchCedula || matchEsp;
    })
  }

  get recepcionistasFiltradas() {
    return this.recepcionistas.filter(r => {
      const query = this.searchQuery.toLowerCase()
      if (!query) return true
      
      const matchNombre = (r.nombre || '').toLowerCase().includes(query)
      const matchApellido = (r.apellido || '').toLowerCase().includes(query)
      const matchCedula = (r.cedula || '').toLowerCase().includes(query)

      if (this.searchFilter === 'nombre') return matchNombre;
      if (this.searchFilter === 'apellido') return matchApellido;
      if (this.searchFilter === 'cedula') return matchCedula;
      
      return matchNombre || matchApellido || matchCedula;
    })
  }

  get administradoresFiltrados() {
    return this.administradores.filter(a => {
      const query = this.searchQuery.toLowerCase()
      if (!query) return true
      
      const matchNombre = (a.nombre || '').toLowerCase().includes(query)
      const matchApellido = (a.apellido || '').toLowerCase().includes(query)
      const matchCedula = (a.cedula || '').toLowerCase().includes(query)

      if (this.searchFilter === 'nombre') return matchNombre;
      if (this.searchFilter === 'apellido') return matchApellido;
      if (this.searchFilter === 'cedula') return matchCedula;
      
      return matchNombre || matchApellido || matchCedula;
    })
  }

  get especialidadesFiltradas() {
    return this.especialidades.filter(e => {
      const query = this.searchQuery.toLowerCase()
      if (!query) return true

      const matchNombre = (e.nombre || '').toLowerCase().includes(query)
      const matchPrefijo = (e.prefijo || '').toLowerCase().includes(query)

      if (this.searchFilter === 'nombre') return matchNombre
      if (this.searchFilter === 'prefijo') return matchPrefijo
      return matchNombre || matchPrefijo
    })
  }


  // --- Cierre del día ---
  cerrarJornada() {
    if (!confirm('¿Está seguro de cerrar la jornada? Se exportará el reporte.')) return
    this.exportarPDF()
    this.apiService.cerrarSistema().subscribe({
      next: () => {
        this.cargarDatos()
        alert('Jornada cerrada. Reporte descargado.')
      },
      error: () => alert('Error al cerrar jornada')
    })
  }

  // --- Exportar PDF ---
  exportarPDF() {
    const doc = new jsPDF()
    const fecha = new Date().toLocaleDateString('es-AR')

    doc.setFillColor(37, 99, 235)
    doc.rect(0, 0, 210, 28, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('CLÍNICA CENTRAL - Reporte Diario', 14, 12)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Fecha: ${fecha}`, 14, 22)

    doc.setTextColor(30, 30, 30)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Resumen de la Jornada', 14, 38)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text(`Pacientes atendidos: ${this.totalAtendidos}`, 14, 48)
    doc.text(`Pacientes ausentes: ${this.totalAusentes}`, 14, 55)
    doc.text(`Tiempo promedio de espera: ${this.tiempoPromedioEspera} min`, 14, 62)
    doc.text(`Duración promedio de consulta: ${this.tiempoPromedioAtencion} min`, 14, 69)

    doc.save(`reporte-clinica-${fecha.replace(/\//g, '-')}.pdf`)
  }

  // --- Exportar CSV ---
  exportarExcel() {
    const headers = ['ID', 'Servicio', 'Nombre', 'Tipo', 'Estado']
    const filas = this.consultorios.map(c => [c.id, c.servicio_id, c.nombre, 'Consultorio', c.estado])
    const csv = [headers, ...filas].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `reporte-clinica-${new Date().toLocaleDateString('es-AR').replace(/\//g, '-')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // --- Estadísticas avanzadas ---
  cargarEstadisticasAvanzadas() {
    this.loadingStats = true
    this.errorStats = null
    this.apiService.getEstadisticasAvanzadas(this.fechaInicio, this.fechaFin).subscribe({
      next: (data: any) => {
        this.estadisticasAvanzadas = data
        
        // Actualizar KPIs superiores
        this.totalAtendidos = data.estadisticas?.total_pacientes || 0
        this.tiempoPromedioEspera = data.estadisticas?.espera || 0
        this.tiempoPromedioAtencion = data.estadisticas?.atencion || 0
        
        this.generarChartData()
        this.crearGraficos()
        this.loadingStats = false
      },
      error: () => {
        this.loadingStats = false
        this.errorStats = 'Error al cargar estadísticas'
      }
    })
  }

  generarChartData() {
    if (!this.estadisticasAvanzadas) return
    const ps = this.estadisticasAvanzadas.por_servicio || []
    this.maxValue = Math.max(...ps.map((s: any) => Number(s.total) || 0), 1)
    
    this.chartData = {
      servicios: ps.map((s: any) => ({
        nombre: s.nombre,
        total: Number(s.total) || 0,
        barWidth: ((Number(s.total) || 0) / this.maxValue) * 100
      })),
      porPago: this.estadisticasAvanzadas.por_pago || [],
      auditoria: this.estadisticasAvanzadas.auditoria || []
    }
  }

  crearGraficos() {
    this.charts.forEach(c => c.destroy())
    this.charts = []
    if (!this.estadisticasAvanzadas) return

    try {
      const servicios = this.estadisticasAvanzadas.por_servicio || []
      if (this.servicioChartRef) {
        const ch1 = new Chart(this.servicioChartRef.nativeElement, {
          type: 'bar',
          data: {
            labels: servicios.map((s: any) => s.nombre),
            datasets: [
              { 
                label: 'Pacientes', 
                data: servicios.map((s: any) => s.total), 
                backgroundColor: '#3b82f6',
                borderRadius: 12
              }
            ]
          },
          options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
        })
        this.charts.push(ch1)
      }

      const pagos = this.estadisticasAvanzadas.por_pago || []
      if (this.medicoChartRef && pagos.length > 0) {
        const ch2 = new Chart(this.medicoChartRef.nativeElement, {
          type: 'doughnut',
          data: { 
            labels: pagos.map((p: any) => p.nombre), 
            datasets: [{ 
              data: pagos.map((p: any) => p.total), 
              backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'] 
            }] 
          },
          options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
        })
        this.charts.push(ch2)
      }
    } catch (e) {
      console.warn('Error al crear gráficos:', e)
    }
  }

  cambiarTab(tab: any) {
    this.activeTab = tab
    this.searchQuery = ''
    this.sidebarOpen = false
    sessionStorage.setItem('admin_activeTab', tab)
    if (tab === 'stats' && !this.estadisticasAvanzadas) {
      this.cargarEstadisticasAvanzadas()
    }
  }

  toggleConfig() {
    this.configExpanded = !this.configExpanded
  }

  // --- Médico Dropdowns ---
  toggleMedicoEspDropdown() {
    this.showMedicoEspDropdown = !this.showMedicoEspDropdown
    this.showMedicoConDropdown = false
  }

  toggleMedicoConDropdown() {
    this.showMedicoConDropdown = !this.showMedicoConDropdown
    this.showMedicoEspDropdown = false
    this.showMedicoPisoDropdown = false
  }

  toggleMedicoPisoDropdown() {
    this.showMedicoPisoDropdown = !this.showMedicoPisoDropdown
    this.showMedicoEspDropdown = false
    this.showMedicoConDropdown = false
  }

  selectMedicoEsp(esp: any) {
    this.formPersonal.servicio_id = esp.id
    this.formPersonal.piso = esp.piso || ''
    this.formPersonal.consultorio_id = ''
    this.showMedicoEspDropdown = false
  }

  get consultoriosDelServicio() {
    if (!this.formPersonal.servicio_id) return this.consultorios;
    return this.consultorios.filter(c => c.servicio_id === this.formPersonal.servicio_id);
  }

  selectMedicoCon(con: any) {
    this.formPersonal.consultorio_id = con.id
    this.showMedicoConDropdown = false
  }

  selectMedicoPiso(piso: string) {
    this.formPersonal.piso = piso
    this.showMedicoPisoDropdown = false
  }

  getPisosDisponibles(): string[] {
    const pisos = this.consultorios.map(c => String(c.piso)).filter(p => p)
    return [...new Set(pisos)].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  }

  getSedeLabel(id: any, forDropdown = false): string {
    if (id === undefined || id === null || id === '') return forDropdown ? 'Seleccione...' : 'SIN ASIGNAR';
    
    const finalId = Number(id);
    if (isNaN(finalId)) return forDropdown ? 'Seleccione...' : 'SIN ASIGNAR';
    
    const sede = this.sedes.find((s) => Number(s.id_sede) === finalId || Number(s.id) === finalId)
    return sede ? sede.nombre.toUpperCase() : (forDropdown ? 'Seleccione...' : 'SIN ASIGNAR')
  }

  toggleSedeDropdown() {
    this.showSedeDropdown = !this.showSedeDropdown
    this.showMedicoEspDropdown = false
    this.showMedicoConDropdown = false
    this.showMedicoPisoDropdown = false
  }

  selectSede(id: number) {
    this.formPersonal.id_sede = id
    this.showSedeDropdown = false
  }

  getNombreEsp(id: string, forDropdown = false): string {
    const esp = this.especialidades.find((e) => e.id === id)
    return esp ? esp.nombre : (forDropdown ? 'Seleccione...' : 'SIN ASIGNAR')
  }

  getNombreCon(id: any, forDropdown = false): string {
    const con = this.consultorios.find((c) => c.id == id)
    return con ? con.nombre.toUpperCase() : (forDropdown ? 'Seleccione...' : 'SIN ASIGNAR')
  }

  getPisoCon(id: any): string {
    const con = this.consultorios.find((c) => c.id == id)
    return con ? con.piso : 'SIN ASIGNAR'
  }

  getConsultoriosDeServicio(servicioId: any): string {
    const cons = this.consultorios.filter(c => c.servicio_id == servicioId)
    if (cons.length === 0) return ''
    return cons.map(c => c.nombre).join(' • ')
  }

  // --- Search Filter Dropdown ---
  toggleSearchFilterDropdown() {
    this.showSearchFilterDropdown = !this.showSearchFilterDropdown
  }

  selectSearchFilter(val: string) {
    this.searchFilter = val
    this.showSearchFilterDropdown = false
  }

  getSearchFilterLabel(val: string): string {
    const map: any = {
      all: 'Todo',
      nombre: 'Nombre',
      apellido: 'Apellido',
      cedula: 'Cédula',
      especialidad: 'Especialidad',
      prefijo: 'Prefijo',
      servicio: 'Servicio'
    }
    return map[val] || 'Filtrar'
  }

  // --- Rol Dropdown ---
  toggleRolDropdown() {
    this.showRolDropdown = !this.showRolDropdown
  }

  selectRol(rol: string) {
    this.formPersonal.rol = rol
    this.showRolDropdown = false
  }

  getRolLabel(rol: string): string {
    const labels: { [key: string]: string } = {
      admin: 'Administrador',
      medico: 'Médico',
      recepcionista: 'Recepcionista'
    }
    return labels[rol] || 'Seleccione...'
  }

  logout() {
    this.authService.logout()
  }

  // --- Click Outside Handler ---
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement
    
    // Close Search Filter Dropdown
    if (!target.closest('.search-filter-container')) {
      this.showSearchFilterDropdown = false
    }

    // Close Medico Esp Dropdown
    if (!target.closest('.medico-esp-container')) {
      this.showMedicoEspDropdown = false
    }

    // Close Medico Con Dropdown
    if (!target.closest('.medico-con-container')) {
      this.showMedicoConDropdown = false
    }

    // Close Medico Piso Dropdown
    if (!target.closest('.medico-piso-container')) {
      this.showMedicoPisoDropdown = false
    }

    // Close Rol Dropdown
    if (!target.closest('.rol-dropdown-container')) {
      this.showRolDropdown = false
    }

    // Close Sede Dropdown
    if (!target.closest('.sede-dropdown-container')) {
      this.showSedeDropdown = false
    }
  }

  // --- VALIDACIONES DE INPUT ---
  soloLetras(event: any) {
    const pattern = /[a-zA-ZáéíóúÁÉÍÓÚñÑ ]/;
    const inputChar = String.fromCharCode(event.charCode);
    if (event.charCode !== 0 && !pattern.test(inputChar)) {
      event.preventDefault();
    }
  }

  soloNumeros(event: any) {
    const pattern = /[0-9]/;
    const inputChar = String.fromCharCode(event.charCode);
    if (event.charCode !== 0 && !pattern.test(inputChar)) {
      event.preventDefault();
    }
  }

  letrasYNumeros(event: any) {
    const pattern = /[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ ]/;
    const inputChar = String.fromCharCode(event.charCode);
    if (event.charCode !== 0 && !pattern.test(inputChar)) {
      event.preventDefault();
    }
  }

  sinEspacios(event: any) {
    if (event.charCode === 32) {
      event.preventDefault();
    }
  }
}
