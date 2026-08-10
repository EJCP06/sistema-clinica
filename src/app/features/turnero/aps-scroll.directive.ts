import { Directive, ElementRef, Input, AfterViewInit, OnDestroy, OnChanges } from '@angular/core';

@Directive({
  selector: '[apsScroll]',
  standalone: true,
})
/**
 * Directiva de scroll automático para el tablero.
 * Mide la altura REAL de las tarjetas en el DOM (funciona en móvil y PC,
 * donde las tarjetas no miden lo mismo) y ajusta la altura del viewport
 * (el padre) para mostrar exactamente `apsScrollMaxVisible` tarjetas sin
 * cortarlas. Cuando hay MÁS tarjetas que visibles, anima en bucle.
 */
export class ApsScrollDirective implements AfterViewInit, OnDestroy, OnChanges {
  @Input({ required: true }) apsScroll = 0;
  @Input() apsScrollSpeed = 40;
  /** Cantidad de tarjetas visibles: la animación solo arranca si hay MÁS que este número. */
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
    }
    this.remeasure();
  }

  private get maxVisible(): number {
    return this.apsScrollMaxVisible > 0 ? this.apsScrollMaxVisible : 1;
  }

  private get viewport(): HTMLElement | null {
    return this.el.nativeElement.parentElement;
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

  private viewportHMedido(): number {
    if (this.cardH <= 0) return 0;
    return this.maxVisible * this.cardH + (this.maxVisible - 1) * this.gap;
  }

  private remeasure() {
    this.medirTarjetas();
    const vp = this.viewport;
    if (!vp) return;
    const vpH = this.viewportHMedido();
    if (this.apsScroll > this.maxVisible && vpH > 0) {
      vp.style.height = vpH + 'px';
      this.startAnim(vpH);
    } else {
      vp.style.height = 'auto';
      this.stopAnim();
    }
  }

  private startAnim(vpH: number) {
    this.stopAnim();
    if (this.apsScroll <= this.maxVisible || !vpH || this.cardH <= 0) return;
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
