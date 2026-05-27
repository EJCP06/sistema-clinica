declare namespace Cypress {
  interface Chainable {
    login(cedula: string, password: string): Chainable<void>;
    loginAsAdmin(): Chainable<void>;
    loginAsRecepcionista(): Chainable<void>;
    loginAsMedico(): Chainable<void>;
  }
}
