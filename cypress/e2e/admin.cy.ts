describe('Admin Dashboard', () => {
  beforeEach(() => {
    cy.loginAsAdmin();
  });

  it('should load admin dashboard', () => {
    cy.url().should('include', '/admin');
    cy.contains('Dashboard').should('be.visible');
  });

  it('should display key metric cards', () => {
    cy.contains('Pacientes en Espera').should('be.visible');
    cy.contains('En Atención').should('be.visible');
    cy.contains('Completados Hoy').should('be.visible');
  });
});
