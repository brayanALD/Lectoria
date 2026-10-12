import { isValidEmail, isValidPassword } from './validation';

describe('isValidEmail', () => {
  it('acepta correos con formato válido, ignorando espacios en los extremos', () => {
    expect(isValidEmail('lector@correo.com')).toBe(true);
    expect(isValidEmail('  lector@correo.com ')).toBe(true);
  });

  it('rechaza correos incompletos o con espacios internos', () => {
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('lector')).toBe(false);
    expect(isValidEmail('lector@correo')).toBe(false);
    expect(isValidEmail('lec tor@correo.com')).toBe(false);
  });
});

describe('isValidPassword', () => {
  it('exige al menos 6 caracteres', () => {
    expect(isValidPassword('12345')).toBe(false);
    expect(isValidPassword('123456')).toBe(true);
  });
});
