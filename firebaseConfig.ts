import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

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

const isFirstInit = getApps().length === 0;
const app = isFirstInit ? initializeApp(config) : getApp();

// initializeAuth solo puede llamarse una vez; en recargas en caliente se reutiliza la instancia.
export const auth = isFirstInit
  ? initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })
  : getAuth(app);

export const db = getFirestore(app);
