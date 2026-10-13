import { getFirestoreErrorMessage } from './firestoreErrors';

describe('getFirestoreErrorMessage', () => {
  it.each(['permission-denied', 'unauthenticated', 'unavailable', 'deadline-exceeded', 'resource-exhausted', 'not-found'])(
    'traduce el código conocido %s',
    (code) => {
      const message = getFirestoreErrorMessage({ code });
      expect(message).toBeTruthy();
      expect(message).not.toContain(code);
    },
  );

  it('explica qué hacer cuando el servidor no responde a tiempo', () => {
    expect(getFirestoreErrorMessage({ code: 'lectoria/timeout' })).toMatch(/ya aparece en tu biblioteca/);
  });

  it('orienta al usuario cuando no hay conexión', () => {
    expect(getFirestoreErrorMessage({ code: 'unavailable' })).toMatch(/conexión/);
  });

  it('muestra el código cuando no lo conoce, para poder diagnosticarlo', () => {
    expect(getFirestoreErrorMessage({ code: 'failed-precondition' })).toContain('(failed-precondition)');
  });

  it('devuelve un mensaje genérico para valores que no son errores de Firestore', () => {
    const fallback = 'No se pudo completar la operación. Inténtalo de nuevo.';
    expect(getFirestoreErrorMessage(new Error('x'))).toBe(fallback);
    expect(getFirestoreErrorMessage(null)).toBe(fallback);
    expect(getFirestoreErrorMessage('texto')).toBe(fallback);
  });
});
