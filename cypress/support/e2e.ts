Cypress.Commands.add('login', (cedula: string, password: string) => {
  cy.visit('/login');
  cy.get('input[name="cedula"]').type(cedula);
  cy.get('input[name="password"]').type(password);
  cy.get('button[type="submit"]').click();
  cy.url().should('not.include', '/login');
});

Cypress.Commands.add('loginAsAdmin', () => {
  cy.login('00000000', '123456');
  cy.url().should('include', '/administrador');
});

Cypress.Commands.add('loginAsRecepcionista', () => {
  cy.login('00000000', '123456');
  cy.visit('/recepcion');
  cy.url().should('include', '/recepcion');
});

Cypress.Commands.add('loginAsMedico', () => {
  cy.request('POST', 'http://localhost:3001/api/auth/login', {
    username: '00000000',
    password: '123456',
  }).then((res) => {
    window.sessionStorage.setItem('token', res.body.token);
    window.sessionStorage.setItem('usuario', JSON.stringify(res.body.usuario));
  });
  cy.visit('/atencion');
});
