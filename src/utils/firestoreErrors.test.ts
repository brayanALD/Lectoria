import { createOfflineError, createOfflineGuard, getFirestoreErrorMessage } from './firestoreErrors';

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

describe('createOfflineGuard', () => {
  const snap = (empty: boolean, fromCache: boolean) => ({ empty, metadata: { fromCache } });

  it('un vacío sacado de la caché, al empezar, no se puede dar por cierto', () => {
    expect(createOfflineGuard()(snap(true, true))).toBe(true);
  });

  it('un vacío confirmado por el servidor sí es una lista vacía', () => {
    expect(createOfflineGuard()(snap(true, false))).toBe(false);
  });

  it('con datos, aunque vengan de la caché, se muestran', () => {
    expect(createOfflineGuard()(snap(false, true))).toBe(false);
    expect(createOfflineGuard()(snap(false, false))).toBe(false);
  });

  it('tras recibir algo cierto, un vacío de la caché es cierto (se eliminó lo último sin red)', () => {
    const isOffline = createOfflineGuard();
    expect(isOffline(snap(false, true))).toBe(false);
    expect(isOffline(snap(true, true))).toBe(false);
  });

  it('mientras no llegue nada cierto sigue avisando, y al llegar el servidor deja de avisar', () => {
    const isOffline = createOfflineGuard();
    expect(isOffline(snap(true, true))).toBe(true);
    expect(isOffline(snap(true, true))).toBe(true);
    expect(isOffline(snap(true, false))).toBe(false);
    expect(isOffline(snap(true, true))).toBe(false);
  });

  it('cada suscripción lleva su propia cuenta', () => {
    const first = createOfflineGuard();
    first(snap(false, false));
    expect(createOfflineGuard()(snap(true, true))).toBe(true);
  });
});

describe('createOfflineError', () => {
  it('se traduce como falta de conexión', () => {
    expect(getFirestoreErrorMessage(createOfflineError())).toMatch(/Sin conexión/);
  });
});
