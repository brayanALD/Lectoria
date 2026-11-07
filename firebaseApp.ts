import { getApp, getApps, initializeApp } from 'firebase/app';

// Configuración de Firebase compartida por la app móvil (`firebaseConfig.ts`) y la web (`firebaseConfig.web.ts`): las dos
// leen del mismo proyecto, así que ven exactamente los mismos datos.
// Expo sustituye las variables EXPO_PUBLIC_* solo cuando se referencian de forma literal
// (process.env.EXPO_PUBLIC_X); no se puede acceder con claves dinámicas.
const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const missing = Object.entries(config)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missing.length > 0) {
  throw new Error(
    `Falta configurar Firebase (${missing.join(', ')}). Copia .env.example a .env, completa los valores y reinicia Expo con "npx expo start -c".`,
  );
}

/** `false` en recargas en caliente: la app de Firebase ya existe y hay que reutilizar sus instancias. */
export const isFirstInit = getApps().length === 0;
export const app = isFirstInit ? initializeApp(config) : getApp();
