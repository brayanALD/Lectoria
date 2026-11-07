import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuth, getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

import { app, isFirstInit } from './firebaseApp';

// Versión móvil. En web, Metro usa `firebaseConfig.web.ts` en su lugar (misma interfaz: `auth` y `db`).

// initializeAuth solo puede llamarse una vez; en recargas en caliente se reutiliza la instancia.
export const auth = isFirstInit
  ? initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })
  : getAuth(app);

export const db = getFirestore(app);
