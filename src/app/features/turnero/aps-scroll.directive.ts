import { Directive, ElementRef, Input, AfterViewInit, OnDestroy, OnChanges, SimpleChanges } from '@angular/core';

@Directive({
  selector: '[apsScroll]',
  standalone: true,
})
export class ApsScrollDirective implements AfterViewInit, OnDestroy, OnChanges {
  @Input({ required: true }) apsScroll = 0;
  @Input() apsScrollViewportH = 0;
  @Input() apsScrollSpeed = 40;

  private anim: Animation | null = null;
  private viewReady = false;
  private readonly CARD_H = 90;
  private readonly GAP = 12;
  private readonly MAX_VISIBLE = 4;

  constructor(private el: ElementRef<HTMLElement>) {}

  ngOnChanges(changes: SimpleChanges) {
    if (this.viewReady) this.startAnim();
  }

  ngAfterViewInit() {
    this.viewReady = true;
    this.startAnim();
  }

  private startAnim() {
    this.anim?.cancel();
    this.anim = null;
    if (this.apsScroll <= this.MAX_VISIBLE || !this.apsScrollViewportH) return;
    const contentH = this.apsScroll * this.CARD_H + (this.apsScroll - 1) * this.GAP;
    const upDist = contentH;
    const downDist = this.apsScrollViewportH;
    const totalDist = upDist + downDist;
    const duration = Math.max(Math.round(totalDist / this.apsScrollSpeed), 6) * 1000;
    const upPct = upDist / totalDist;
    this.anim = this.el.nativeElement.animate([
      { transform: 'translateY(0)' },
      { transform: `translateY(-${upDist}px)`, offset: upPct },
      { transform: `translateY(${downDist}px)`, offset: upPct + 0.0001 },
      { transform: 'translateY(0)', offset: 1 },
    ], { duration, iterations: Infinity, easing: 'linear' });
  }

  ngOnDestroy() {
    this.anim?.cancel();
  }
}
