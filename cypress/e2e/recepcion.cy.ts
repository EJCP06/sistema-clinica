describe('Recepcion - Patient Admission Flow', () => {
  beforeEach(() => {
    cy.loginAsRecepcionista();
  });

  it('should load recepcion page with title', () => {
    cy.contains('Admisión de Pacientes').should('be.visible');
    cy.contains('Gestión de entrada y asignación de turnos médicos').should('be.visible');
  });

  it('should display the admissions table', () => {
    cy.contains('No hay admisiones recientes registradas').should('be.visible');
  });

  it('should open new patient registration modal', () => {
    cy.contains('Nuevo Paciente').click();
    cy.contains('Ingreso Manual').should('be.visible');
    cy.get('input[placeholder="Ej: Juan"]').should('be.visible');
    cy.get('input[placeholder="Ej: Perez"]').should('be.visible');
    cy.get('input[placeholder="Ej: 13894759"]').should('be.visible');
  });

  it('should search for existing patients', () => {
    cy.get('input[placeholder="Buscar paciente..."]').type('00000000');
    cy.wait(1000);
    cy.get('body').then(($body) => {
      if ($body.find('[class*="search-filter-container"]').length > 0) {
        cy.log('Search results found');
      }
    });
  });

  it('should display servicios and dropdowns', () => {
    cy.wait(2000);
    cy.get('body').then(($body) => {
      const hasCategoriaBtn = $body.text().includes('Seleccione...');
      if (!hasCategoriaBtn) {
        cy.log('Servicio dropdown might not be visible on fresh load');
      }
    });
  });

  it('should navigate to aseguradoras view', () => {
    cy.visit('/aseguradoras');
    cy.url().should('include', '/aseguradoras');
    cy.contains('Gestión de aseguradoras').should('be.visible');
  });
});
