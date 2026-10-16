import { getFirestoreErrorMessage } from './firestoreErrors';

// Mismo texto para los tres errores de credenciales, para no revelar si el correo existe.
const INVALID_CREDENTIALS =
  'Correo o contraseña incorrectos. Si creaste la cuenta con Google, usa «Continuar con Google».';

const MESSAGES: Record<string, string> = {
  'auth/invalid-credential': INVALID_CREDENTIALS,
  'auth/wrong-password': INVALID_CREDENTIALS,
  'auth/user-not-found': INVALID_CREDENTIALS,
  'auth/invalid-email': 'El correo no es válido.',
  'auth/email-already-in-use':
    'Ya existe una cuenta con ese correo. Si la creaste con Google, entra con «Continuar con Google» y añade una contraseña desde Mi espacio.',
  'auth/user-mismatch': 'Esa no es la cuenta con la que has entrado. Elige la misma cuenta de Google.',
  'auth/provider-already-linked': 'Ese método de acceso ya está vinculado a tu cuenta.',
  'auth/credential-already-in-use': 'Esa cuenta de Google ya está asociada a otra cuenta de Lectoria.',
  'auth/requires-recent-login': 'Por seguridad, cierra sesión, vuelve a entrar e inténtalo de nuevo.',
  'lectoria/no-email': 'Tu cuenta no tiene un correo asociado, así que no se puede añadir una contraseña.',
  'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
  'auth/user-disabled': 'Esta cuenta está deshabilitada.',
  'auth/too-many-requests': 'Demasiados intentos. Inténtalo de nuevo más tarde.',
  'auth/network-request-failed': 'Sin conexión. Revisa tu red e inténtalo de nuevo.',
  'auth/account-exists-with-different-credential':
    'Ese correo ya tiene una cuenta con otro método de acceso. Entra con ese método y vincula este desde Mi espacio.',
  'lectoria/google-not-configured': 'El acceso con Google no está configurado en esta versión de la app.',
  'lectoria/google-unavailable':
    'El acceso con Google no está disponible aquí. Requiere la app de desarrollo, no funciona en Expo Go.',
  'lectoria/google-play-services': 'Google Play Services no está disponible o está desactualizado.',
  'lectoria/google-no-token': 'Google no devolvió las credenciales necesarias. Inténtalo de nuevo.',
};

const FALLBACK = 'No se pudo completar la operación. Inténtalo de nuevo.';

export function getAuthErrorMessage(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code)
      : '';

  if (code === 'lectoria/google-failed') {
    const detail = (error as { detail?: unknown }).detail;
    return `No se pudo iniciar sesión con Google${detail ? ` (${String(detail)})` : ''}.`;
  }
  if (MESSAGES[code]) return MESSAGES[code];
  // Código desconocido: se muestra para poder diagnosticarlo.
  return code ? `${FALLBACK} (${code})` : FALLBACK;
}

const FIRESTORE_CODES = ['permission-denied', 'unauthenticated', 'unavailable', 'deadline-exceeded', 'not-found', 'lectoria/timeout'];

/**
 * El mensaje de un fallo al eliminar la cuenta: una contraseña mal escrita no debe hablar de «correo» ni de Google, y los
 * fallos al borrar los datos son de Firestore, no de Authentication.
 */
export function getDeleteAccountErrorMessage(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error ? String((error as { code: unknown }).code) : '';
  if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') return 'La contraseña no es correcta.';
  if (code === 'lectoria/timeout') {
    return 'No hay respuesta del servidor. Revisa tu conexión e inténtalo de nuevo: se continuará donde se quedó.';
  }
  if (FIRESTORE_CODES.includes(code)) return getFirestoreErrorMessage(error);
  return getAuthErrorMessage(error);
}
