import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Recepcion } from './recepcion';

describe('Recepcion', () => {
  let component: Recepcion;
  let fixture: ComponentFixture<Recepcion>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Recepcion],
    }).compileComponents();

    fixture = TestBed.createComponent(Recepcion);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
