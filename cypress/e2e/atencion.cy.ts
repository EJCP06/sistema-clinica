describe('Atencion - Doctor Panel Flow', () => {
  beforeEach(() => {
    cy.loginAsMedico();
  });

  it('should load atencion page', () => {
    cy.url().should('include', '/atencion');
    cy.contains('Atención de Pacientes').should('be.visible');
  });

  it('should show current patient state', () => {
    cy.contains('En Cola').should('be.visible');
    cy.contains('En Atención').should('be.visible');
  });
});
