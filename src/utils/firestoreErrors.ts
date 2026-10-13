const MESSAGES: Record<string, string> = {
  'permission-denied': 'No tienes permiso para acceder a estos datos. Cierra sesión y vuelve a entrar.',
  unauthenticated: 'Tu sesión ha caducado. Vuelve a iniciar sesión.',
  unavailable: 'Sin conexión. Revisa tu red e inténtalo de nuevo.',
  'deadline-exceeded': 'La operación tardó demasiado. Revisa tu conexión e inténtalo de nuevo.',
  'resource-exhausted': 'Se alcanzó el límite de uso del servicio. Inténtalo de nuevo más tarde.',
  'not-found': 'No se encontró el elemento. Puede que ya se haya eliminado.',
  'already-exists': 'Ese elemento ya existe.',
};

const FALLBACK = 'No se pudo completar la operación. Inténtalo de nuevo.';

/** Traduce un error de Firestore a un mensaje para el usuario; muestra el código si no lo conoce, para diagnosticarlo. */
export function getFirestoreErrorMessage(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error ? String((error as { code: unknown }).code) : '';
  if (MESSAGES[code]) return MESSAGES[code];
  return code ? `${FALLBACK} (${code})` : FALLBACK;
}
