import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from 'firebase/auth';

import { auth } from '../../firebaseConfig';

export type { User };

export function subscribeToAuthState(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

export async function signInWithEmail(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(auth, email.trim(), password);
}

export async function signUpWithEmail(email: string, password: string, displayName: string): Promise<void> {
  const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
  try {
    await updateProfile(credential.user, { displayName: displayName.trim() });
  } catch (error) {
    // La cuenta ya existe; el nombre también se guarda en el perfil de Firestore.
    console.warn('No se pudo guardar el nombre en Firebase Auth', error);
  }
}

function coded(code: string): Error & { code: string } {
  return Object.assign(new Error(code), { code });
}

/**
 * Inicia sesión con Google. Devuelve false si el usuario cancela el selector de cuentas.
 * La librería nativa se importa al usarla: en Expo Go no existe y no debe romper el arranque de la app.
 */
export async function signInWithGoogle(): Promise<boolean> {
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  if (!webClientId) throw coded('lectoria/google-not-configured');

  let google: typeof import('@react-native-google-signin/google-signin');
  try {
    google = await import('@react-native-google-signin/google-signin');
    google.GoogleSignin.configure({ webClientId });
  } catch {
    throw coded('lectoria/google-unavailable');
  }

  try {
    await google.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await google.GoogleSignin.signIn();
    if (!google.isSuccessResponse(response)) return false;

    const idToken = response.data.idToken;
    if (!idToken) throw coded('lectoria/google-no-token');
    await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
    return true;
  } catch (error) {
    if (google.isErrorWithCode(error)) {
      if (error.code === google.statusCodes.IN_PROGRESS) return false;
      if (error.code === google.statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw coded('lectoria/google-play-services');
      }
    }
    console.warn('Fallo en el acceso con Google', error);
    const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
    // Los errores de Firebase (auth/...) y los propios (lectoria/...) se traducen tal cual;
    // el resto, de la librería de Google, se envuelve para poder ver el detalle en pantalla.
    if (code.startsWith('auth/') || code.startsWith('lectoria/')) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw Object.assign(new Error(message), {
      code: 'lectoria/google-failed',
      detail: code ? `${code}: ${message}` : message,
    });
  }
}

export async function signOutUser(): Promise<void> {
  const usedGoogle = auth.currentUser?.providerData.some((p) => p.providerId === 'google.com');
  await firebaseSignOut(auth);
  if (!usedGoogle) return;

  // Cierra también la sesión de Google para que la próxima vez se pueda elegir otra cuenta.
  try {
    const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
    await GoogleSignin.signOut();
  } catch (error) {
    console.warn('No se pudo cerrar la sesión de Google', error);
  }
}
