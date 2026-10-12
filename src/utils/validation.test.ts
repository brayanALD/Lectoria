import {
  MAX_DISPLAY_NAME_LENGTH,
  MAX_NICKNAME_LENGTH,
  isValidDisplayName,
  isValidEmail,
  isValidNickname,
  isValidPassword,
} from './validation';

describe('isValidDisplayName', () => {
  it('exige texto no vacío, ignorando espacios en los extremos', () => {
    expect(isValidDisplayName('Ana')).toBe(true);
    expect(isValidDisplayName('')).toBe(false);
    expect(isValidDisplayName('   ')).toBe(false);
  });

  it('respeta la longitud máxima', () => {
    expect(isValidDisplayName('a'.repeat(MAX_DISPLAY_NAME_LENGTH))).toBe(true);
    expect(isValidDisplayName('a'.repeat(MAX_DISPLAY_NAME_LENGTH + 1))).toBe(false);
  });
});

describe('isValidNickname', () => {
  it('acepta el apodo vacío porque es opcional', () => {
    expect(isValidNickname('')).toBe(true);
    expect(isValidNickname('   ')).toBe(true);
    expect(isValidNickname('Lectora')).toBe(true);
  });

  it('respeta la longitud máxima', () => {
    expect(isValidNickname('a'.repeat(MAX_NICKNAME_LENGTH))).toBe(true);
    expect(isValidNickname('a'.repeat(MAX_NICKNAME_LENGTH + 1))).toBe(false);
  });
});

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
