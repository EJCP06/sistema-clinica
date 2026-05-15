import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PantallaPublica } from './pantalla-publica';

describe('PantallaPublica', () => {
  let component: PantallaPublica;
  let fixture: ComponentFixture<PantallaPublica>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PantallaPublica],
    }).compileComponents();

    fixture = TestBed.createComponent(PantallaPublica);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
