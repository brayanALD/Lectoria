import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';

import { db } from '../../firebaseConfig';
import type { ProfileInput } from '../types/user';
import type { User } from './authService';

// Crea users/{uid} si no existe. Es idempotente: se puede llamar en cada inicio de sesión.
// El nombre sale de `input` (registro con correo) o, si no hay, de la cuenta (p. ej. Google).
// La zona horaria alimenta el cálculo de `dateKey` en las sesiones (rachas y calendario).
export async function ensureUserProfile(user: User, input?: ProfileInput): Promise<void> {
  const ref = doc(db, 'users', user.uid);
  const snapshot = await getDoc(ref);
  if (snapshot.exists()) return;

  const displayName =
    input?.displayName.trim() || user.displayName?.trim() || user.email?.split('@')[0] || 'Lector';
  const nickname = input?.nickname?.trim();

  await setDoc(ref, {
    createdAt: serverTimestamp(),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC',
    displayName,
    ...(nickname ? { nickname } : {}),
  });
}
