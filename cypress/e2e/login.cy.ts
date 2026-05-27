describe('Login Flow', () => {
  beforeEach(() => {
    cy.visit('/login');
  });

  it('should display login page', () => {
    cy.contains('Bienvenido').should('be.visible');
    cy.contains('Ingresa tus credenciales para acceder').should('be.visible');
    cy.get('input[name="cedula"]').should('be.visible');
    cy.get('input[name="password"]').should('be.visible');
    cy.get('button[type="submit"]').should('contain', 'Iniciar Sesión');
  });

  it('should show error with invalid credentials', () => {
    cy.get('input[name="cedula"]').type('99999999');
    cy.get('input[name="password"]').type('wrongpass');
    cy.get('button[type="submit"]').click();
    cy.contains('Error de autenticación').should('be.visible');
  });

  it('should show validation error on empty fields', () => {
    cy.get('button[type="submit"]').click();
    cy.contains('Por favor ingrese su cédula y contraseña.').should('be.visible');
  });

  it('should login as admin and redirect to /admin', () => {
    cy.loginAsAdmin();
    cy.url().should('include', '/admin');
  });

  it('should toggle dark mode', () => {
    cy.get('input[type="checkbox"]').first().click();
    cy.get('html').should('have.class', 'dark');
    cy.get('input[type="checkbox"]').first().click();
    cy.get('html').should('not.have.class', 'dark');
  });
});
