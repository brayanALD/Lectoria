import { getAuthErrorMessage } from './authErrors';

describe('getAuthErrorMessage', () => {
  it('traduce códigos conocidos de Firebase', () => {
    expect(getAuthErrorMessage({ code: 'auth/email-already-in-use' })).toBe(
      'Ya existe una cuenta con ese correo.',
    );
  });

  it('unifica los errores de credenciales para no revelar si el correo existe', () => {
    const invalid = getAuthErrorMessage({ code: 'auth/invalid-credential' });
    expect(getAuthErrorMessage({ code: 'auth/user-not-found' })).toBe(invalid);
    expect(getAuthErrorMessage({ code: 'auth/wrong-password' })).toBe(invalid);
  });

  it('devuelve un mensaje genérico para códigos desconocidos o valores no esperados', () => {
    const fallback = 'No se pudo completar la operación. Inténtalo de nuevo.';
    expect(getAuthErrorMessage({ code: 'auth/otro' })).toBe(fallback);
    expect(getAuthErrorMessage(new Error('x'))).toBe(fallback);
    expect(getAuthErrorMessage(null)).toBe(fallback);
    expect(getAuthErrorMessage('texto')).toBe(fallback);
  });
});
