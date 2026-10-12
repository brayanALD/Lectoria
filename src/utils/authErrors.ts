const MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'Correo o contraseña incorrectos.',
  'auth/wrong-password': 'Correo o contraseña incorrectos.',
  'auth/user-not-found': 'Correo o contraseña incorrectos.',
  'auth/invalid-email': 'El correo no es válido.',
  'auth/email-already-in-use': 'Ya existe una cuenta con ese correo.',
  'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
  'auth/user-disabled': 'Esta cuenta está deshabilitada.',
  'auth/too-many-requests': 'Demasiados intentos. Inténtalo de nuevo más tarde.',
  'auth/network-request-failed': 'Sin conexión. Revisa tu red e inténtalo de nuevo.',
  'auth/account-exists-with-different-credential':
    'Ya existe una cuenta con ese correo que usa otro método de acceso.',
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
