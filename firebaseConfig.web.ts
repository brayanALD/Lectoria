import { browserLocalPersistence, connectAuthEmulator, getAuth, initializeAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';

import { app, isFirstInit } from './firebaseApp';

// Versión web (Metro la elige en lugar de `firebaseConfig.ts`): la sesión se guarda en el almacenamiento del navegador
// y comparte con la app móvil el mismo proyecto de Firebase, así que ve los mismos datos.

// Solo desarrollo y pruebas: con esta variable la web habla con los emuladores de Firebase (Auth 9099 y Firestore 8080)
// en lugar de producción. En el despliegue no se define.
const emulatorHost = process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST;

// initializeAuth solo puede llamarse una vez; en recargas en caliente se reutiliza la instancia.
export const auth = isFirstInit ? initializeAuth(app, { persistence: browserLocalPersistence }) : getAuth(app);

export const db = getFirestore(app);

if (emulatorHost && isFirstInit) {
  connectAuthEmulator(auth, `http://${emulatorHost}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, emulatorHost, 8080);
}
