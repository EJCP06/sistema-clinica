import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Atencion } from './atencion';

describe('Atencion', () => {
  let component: Atencion;
  let fixture: ComponentFixture<Atencion>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Atencion],
    }).compileComponents();

    fixture = TestBed.createComponent(Atencion);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
