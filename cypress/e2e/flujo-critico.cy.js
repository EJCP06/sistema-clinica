describe('Flujo Crítico: Autenticación', () => {
  it('Debería mostrar error con credenciales incorrectas', () => {
    cy.visit('/login');
    
    // Ingresar credenciales falsas
    cy.get('input[type="text"]').type('usuario_inexistente');
    cy.get('input[type="password"]').type('123456');
    
    // Hacer clic en el botón de Entrar
    cy.contains('button', 'Iniciar Sesión').click();
    
    // Verificar que se muestre un error
    cy.get('.text-rose-600').should('contain', 'Credenciales inválidas');
  });

  // Nota: Para probar un login real sin afectar la DB de producción, normalmente se usaría un usuario "test_admin" 
  // o se interceptaría la petición HTTP usando cy.intercept(). Aquí probamos que al menos la página de login funciona.
  it('Debería cargar la página de Login correctamente', () => {
    cy.visit('/login');
    cy.contains('Bienvenido').should('be.visible');

    cy.get('input[type="text"]').should('be.visible');
    cy.get('input[type="password"]').should('be.visible');
  });
});
