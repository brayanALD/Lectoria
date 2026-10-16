import { getAuthErrorMessage, getDeleteAccountErrorMessage } from './authErrors';

describe('getAuthErrorMessage', () => {
  it('traduce códigos conocidos de Firebase', () => {
    expect(getAuthErrorMessage({ code: 'auth/weak-password' })).toMatch(/al menos 6 caracteres/);
  });

  it('orienta al usuario cuando el correo ya existe con otro método de acceso', () => {
    expect(getAuthErrorMessage({ code: 'auth/email-already-in-use' })).toMatch(/Continuar con Google/);
    expect(getAuthErrorMessage({ code: 'auth/invalid-credential' })).toMatch(/Continuar con Google/);
  });

  it('traduce los errores de la vinculación de métodos de acceso', () => {
    expect(getAuthErrorMessage({ code: 'auth/credential-already-in-use' })).toMatch(/otra cuenta de Lectoria/);
    expect(getAuthErrorMessage({ code: 'auth/provider-already-linked' })).toMatch(/ya está vinculado/);
    expect(getAuthErrorMessage({ code: 'auth/requires-recent-login' })).toMatch(/vuelve a entrar/);
    expect(getAuthErrorMessage({ code: 'lectoria/no-email' })).toMatch(/correo asociado/);
  });

  it('unifica los errores de credenciales para no revelar si el correo existe', () => {
    const invalid = getAuthErrorMessage({ code: 'auth/invalid-credential' });
    expect(getAuthErrorMessage({ code: 'auth/user-not-found' })).toBe(invalid);
    expect(getAuthErrorMessage({ code: 'auth/wrong-password' })).toBe(invalid);
  });

  it('muestra el código cuando no lo conoce, para poder diagnosticarlo', () => {
    expect(getAuthErrorMessage({ code: 'auth/otro' })).toContain('(auth/otro)');
    expect(getAuthErrorMessage({ code: 'lectoria/google-failed', detail: '10: DEVELOPER_ERROR' })).toContain(
      '10: DEVELOPER_ERROR',
    );
  });

  it('traduce los errores propios del acceso con Google', () => {
    expect(getAuthErrorMessage({ code: 'lectoria/google-unavailable' })).toMatch(/Expo Go/);
    expect(getAuthErrorMessage({ code: 'auth/account-exists-with-different-credential' })).toMatch(/otro método/);
  });

  it('devuelve un mensaje genérico para códigos desconocidos o valores no esperados', () => {
    const fallback = 'No se pudo completar la operación. Inténtalo de nuevo.';
    expect(getAuthErrorMessage(new Error('x'))).toBe(fallback);
    expect(getAuthErrorMessage(null)).toBe(fallback);
    expect(getAuthErrorMessage('texto')).toBe(fallback);
  });
});

describe('getDeleteAccountErrorMessage', () => {
  it('una contraseña mal escrita no habla de correo ni de Google', () => {
    for (const code of ['auth/wrong-password', 'auth/invalid-credential']) {
      expect(getDeleteAccountErrorMessage({ code })).toBe('La contraseña no es correcta.');
    }
  });

  it('avisa si se elige otra cuenta de Google', () => {
    expect(getDeleteAccountErrorMessage({ code: 'auth/user-mismatch' })).toMatch(/misma cuenta de Google/);
  });

  it('un fallo al borrar los datos se explica como de conexión o de permisos', () => {
    expect(getDeleteAccountErrorMessage({ code: 'lectoria/timeout' })).toMatch(/se continuará donde se quedó/);
    expect(getDeleteAccountErrorMessage({ code: 'unavailable' })).toMatch(/Sin conexión/);
    expect(getDeleteAccountErrorMessage({ code: 'permission-denied' })).toMatch(/No tienes permiso/);
  });

  it('el resto de errores usa los mensajes de acceso', () => {
    expect(getDeleteAccountErrorMessage({ code: 'auth/network-request-failed' })).toMatch(/Sin conexión/);
    expect(getDeleteAccountErrorMessage({ code: 'auth/too-many-requests' })).toMatch(/Demasiados intentos/);
    expect(getDeleteAccountErrorMessage(new Error('x'))).toMatch(/No se pudo completar/);
  });
});
