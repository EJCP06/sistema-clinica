import { Directive, ElementRef, Input, AfterViewInit, OnDestroy, OnChanges } from '@angular/core';

@Directive({
  selector: '[apsScroll]',
  standalone: true,
})
/**
 * Directiva de scroll automático para el tablero.
 * Mide la altura REAL de las tarjetas en el DOM y el espacio REAL disponible
 * en el panel que las contiene, de modo que la animación arranca justo cuando
 * la lista YA NO CABE — sin depender de un número fijo de tarjetas visibles.
 */
export class ApsScrollDirective implements AfterViewInit, OnDestroy, OnChanges {
  @Input({ required: true }) apsScroll = 0;
  @Input() apsScrollSpeed = 40;
  /** Respaldo: cantidad de tarjetas visibles si no se puede medir el espacio disponible. */
  @Input() apsScrollMaxVisible = 4;

  private anim: Animation | null = null;
  private viewReady = false;
  private cardH = 0;
  private gap = 0;
  private ro: ResizeObserver | null = null;

  constructor(private el: ElementRef<HTMLElement>) {}

  ngOnChanges() {
    if (this.viewReady) this.remeasure();
  }

  ngAfterViewInit() {
    this.viewReady = true;
    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(() => this.remeasure());
      this.ro.observe(this.el.nativeElement);
      const sec = this.seccion;
      if (sec) this.ro.observe(sec);
    }
    this.remeasure();
  }

  private get maxVisible(): number {
    return this.apsScrollMaxVisible > 0 ? this.apsScrollMaxVisible : 1;
  }

  private get viewport(): HTMLElement | null {
    return this.el.nativeElement.parentElement;
  }

  /** La sección (panel con título) que contiene la lista. */
  private get seccion(): HTMLElement | null {
    const vp = this.viewport;
    return vp ? (vp.parentElement as HTMLElement | null) : null;
  }

  /** El contenedor que limita la altura de la sección (grid o columna flex). */
  private get contenedor(): HTMLElement | null {
    const sec = this.seccion;
    return sec ? (sec.parentElement as HTMLElement | null) : null;
  }

  private medirTarjetas() {
    const hijos = Array.from(this.el.nativeElement.children) as HTMLElement[];
    if (!hijos.length) {
      this.cardH = 0;
      this.gap = 0;
      return;
    }
    this.cardH = hijos[0].offsetHeight;
    this.gap =
      hijos.length > 1
        ? Math.max(hijos[1].offsetTop - hijos[0].offsetTop - hijos[0].offsetHeight, 0)
        : 0;
  }

  /** Altura real (px) que el panel puede usar para las tarjetas sin recortarse. */
  private alturaDisponible(): number {
    const vp = this.viewport;
    const sec = this.seccion;
    const cont = this.contenedor;
    if (!vp || !sec || !cont) return 0;
    const cr = cont.getBoundingClientRect();
    const vr = vp.getBoundingClientRect();
    const padBottom = parseFloat(getComputedStyle(sec).paddingBottom) || 0;
    return Math.max(cr.bottom - vr.top - padBottom, 0);
  }

  /** Cuántas tarjetas caben en el espacio disponible (mínimo 1). */
  private visiblesReales(): number {
    const availH = this.alturaDisponible();
    if (availH <= 0 || this.cardH <= 0) return this.maxVisible;
    const n = Math.floor((availH + this.gap) / (this.cardH + this.gap));
    return Math.max(1, n);
  }

  private viewportHMedido(): number {
    if (this.cardH <= 0) return 0;
    const visibles = this.visiblesReales();
    return visibles * this.cardH + (visibles - 1) * this.gap;
  }

  private remeasure() {
    this.medirTarjetas();
    const vp = this.viewport;
    if (!vp) return;
    const visibles = this.visiblesReales();
    const vpH = this.viewportHMedido();
    if (this.apsScroll > visibles && vpH > 0) {
      vp.style.height = vpH + 'px';
      this.startAnim(vpH, visibles);
    } else {
      vp.style.height = 'auto';
      this.stopAnim();
    }
  }

  private startAnim(vpH: number, visibles: number) {
    this.stopAnim();
    if (this.apsScroll <= visibles || !vpH || this.cardH <= 0) return;
    const contentH = this.apsScroll * this.cardH + (this.apsScroll - 1) * this.gap;
    const upDist = contentH;
    const downDist = vpH;
    const totalDist = upDist + downDist;
    const duration = Math.max(Math.round(totalDist / this.apsScrollSpeed), 6) * 1000;
    const upPct = upDist / totalDist;
    this.anim = this.el.nativeElement.animate(
      [
        { transform: 'translateY(0)' },
        { transform: `translateY(-${upDist}px)`, offset: upPct },
        { transform: `translateY(${downDist}px)`, offset: upPct + 0.0001 },
        { transform: 'translateY(0)', offset: 1 },
      ],
      { duration, iterations: Infinity, easing: 'linear' }
    );
  }

  private stopAnim() {
    this.anim?.cancel();
    this.anim = null;
  }

  ngOnDestroy() {
    this.stopAnim();
    this.ro?.disconnect();
    this.ro = null;
  }
}