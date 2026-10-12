import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';

import { db } from '../../firebaseConfig';

// Crea users/{uid} si no existe. Es idempotente: se puede llamar en cada inicio de sesión.
// La zona horaria alimenta el cálculo de `dateKey` en las sesiones (rachas y calendario).
export async function ensureUserProfile(uid: string): Promise<void> {
  const ref = doc(db, 'users', uid);
  const snapshot = await getDoc(ref);
  if (snapshot.exists()) return;

  await setDoc(ref, {
    createdAt: serverTimestamp(),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC',
  });
}
