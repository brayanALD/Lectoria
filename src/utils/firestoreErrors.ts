const MESSAGES: Record<string, string> = {
  'permission-denied': 'No tienes permiso para acceder a estos datos. Cierra sesión y vuelve a entrar.',
  unauthenticated: 'Tu sesión ha caducado. Vuelve a iniciar sesión.',
  unavailable: 'Sin conexión. Revisa tu red e inténtalo de nuevo.',
  'deadline-exceeded': 'La operación tardó demasiado. Revisa tu conexión e inténtalo de nuevo.',
  'resource-exhausted': 'Se alcanzó el límite de uso del servicio. Inténtalo de nuevo más tarde.',
  'not-found': 'No se encontró el elemento. Puede que ya se haya eliminado.',
  'already-exists': 'Ese elemento ya existe.',
  'lectoria/timeout':
    'No hay respuesta del servidor. Revisa tu conexión. Si lo que intentabas guardar ya aparece en tu biblioteca, se guardó correctamente.',
};

const FALLBACK = 'No se pudo completar la operación. Inténtalo de nuevo.';

/** Traduce un error de Firestore a un mensaje para el usuario; muestra el código si no lo conoce, para diagnosticarlo. */
export function getFirestoreErrorMessage(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error ? String((error as { code: unknown }).code) : '';
  if (MESSAGES[code]) return MESSAGES[code];
  return code ? `${FALLBACK} (${code})` : FALLBACK;
}

/**
 * El error con que se avisa de que no se pudo comprobar nada porque no hay conexión. Lleva el código `unavailable` de
 * Firestore, así que `getFirestoreErrorMessage` lo traduce a «Sin conexión…».
 */
export function createOfflineError(): Error & { code: string } {
  return Object.assign(new Error('offline'), { code: 'unavailable' });
}

/**
 * Detecta, en una suscripción, el primer resultado vacío que Firestore saca de su caché sin haber podido consultar al
 * servidor. Con la app recién abierta y sin red, la caché (en memoria en React Native) está vacía y Firestore entrega
 * «sin resultados»: no es una biblioteca vacía, es que no se pudo comprobar, y mostrarlo como vacío parecería que se
 * perdieron los datos. Una vez que la suscripción recibió algo cierto (datos, o el servidor confirmando), un vacío ya es
 * cierto: p. ej. se eliminó el último libro sin red. Se crea una por suscripción; devuelve `true` si el resultado debe
 * tratarse como falta de conexión.
 */
export function createOfflineGuard(): (snapshot: { empty: boolean; metadata: { fromCache: boolean } }) => boolean {
  let confirmed = false;
  return (snapshot) => {
    if (confirmed) return false;
    if (snapshot.empty && snapshot.metadata.fromCache) return true;
    confirmed = true;
    return false;
  };
}
