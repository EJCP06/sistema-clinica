describe('Admin Dashboard', () => {
  beforeEach(() => {
    cy.loginAsAdmin();
  });

  it('should load admin dashboard', () => {
    cy.url().should('include', '/administrador');
    cy.contains('Dashboard Global').should('be.visible');
  });

  it('should display key metric cards', () => {
    cy.contains('Total Admisiones').should('be.visible');
    cy.contains('Pacientes Atendidos').should('be.visible');
    cy.contains('Pacientes en Espera').should('be.visible');
    cy.contains('Pacientes Ausentes').should('be.visible');
  });
});
