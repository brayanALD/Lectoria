import { deleteField, doc, getDoc, onSnapshot, serverTimestamp, setDoc, updateDoc, type Firestore } from 'firebase/firestore';

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

// La meta diaria vive en el perfil (users/{uid}.dailyGoalMinutes, 1–1440). No es una segunda escritura de creación:
// solo actualiza ese campo en un perfil que `ensureUserProfile` ya creó. El parámetro `database` permite probarlo
// contra el emulador; en la app siempre se usa `db`.

/** Fija la meta diaria en minutos, o la quita si `minutes` es `undefined`. */
export async function setDailyGoal(uid: string, minutes: number | undefined, database: Firestore = db): Promise<void> {
  await updateDoc(doc(database, 'users', uid), { dailyGoalMinutes: minutes ?? deleteField() });
}

/** Escucha en tiempo real la meta diaria (`undefined` si no hay). Devuelve la función para cancelar. */
export function subscribeToDailyGoal(
  uid: string,
  onGoal: (minutes: number | undefined) => void,
  onError: (error: Error) => void,
  database: Firestore = db,
): () => void {
  return onSnapshot(
    doc(database, 'users', uid),
    (snapshot) => {
      const goal: unknown = snapshot.data()?.dailyGoalMinutes;
      onGoal(typeof goal === 'number' ? goal : undefined);
    },
    onError,
  );
}
