import { deleteField, doc, getDoc, onSnapshot, serverTimestamp, setDoc, updateDoc, type Firestore } from 'firebase/firestore';

import { db } from '../../firebaseConfig';
import type { DailyGoal } from '../types/goal';
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

// La meta diaria vive en el perfil (users/{uid}), en un campo según su tipo: `dailyGoalMinutes` (1–1440) o
// `dailyGoalPages` (1–10000), nunca los dos. No es una segunda escritura de creación: solo actualiza esos campos en un
// perfil que `ensureUserProfile` ya creó. El parámetro `database` permite probarlo contra el emulador; en la app
// siempre se usa `db`.

/**
 * Fija la meta diaria, o la quita si `goal` es `undefined`. Cambiar de tipo es una sola escritura: se guarda el campo
 * del tipo nuevo y se elimina el del otro, para que nunca queden los dos (las reglas lo rechazan).
 */
export async function setDailyGoal(uid: string, goal: DailyGoal | undefined, database: Firestore = db): Promise<void> {
  await updateDoc(doc(database, 'users', uid), {
    dailyGoalMinutes: goal?.type === 'minutes' ? goal.target : deleteField(),
    dailyGoalPages: goal?.type === 'pages' ? goal.target : deleteField(),
  });
}

/** Escucha en tiempo real la meta diaria (`undefined` si no hay). Devuelve la función para cancelar. */
export function subscribeToDailyGoal(
  uid: string,
  onGoal: (goal: DailyGoal | undefined) => void,
  onError: (error: Error) => void,
  database: Firestore = db,
): () => void {
  return onSnapshot(
    doc(database, 'users', uid),
    (snapshot) => {
      const data = snapshot.data();
      const minutes: unknown = data?.dailyGoalMinutes;
      const pages: unknown = data?.dailyGoalPages;
      // Las metas antiguas solo tienen `dailyGoalMinutes`, así que siguen siendo de minutos sin migrar nada.
      onGoal(
        typeof minutes === 'number'
          ? { type: 'minutes', target: minutes }
          : typeof pages === 'number'
            ? { type: 'pages', target: pages }
            : undefined,
      );
    },
    onError,
  );
}

// El objetivo mensual en libros vive en el mismo perfil, en `monthlyBooksGoal` (entero de 1 a 1000, ver firestore.rules).
// Como la meta diaria, solo actualiza ese campo en un perfil que `ensureUserProfile` ya creó.

/** Fija el objetivo mensual de libros, o lo quita si `target` es `undefined`. */
export async function setMonthlyBooksGoal(uid: string, target: number | undefined, database: Firestore = db): Promise<void> {
  await updateDoc(doc(database, 'users', uid), { monthlyBooksGoal: target ?? deleteField() });
}

/** Escucha en tiempo real el objetivo mensual de libros (`undefined` si no hay). Devuelve la función para cancelar. */
export function subscribeToMonthlyBooksGoal(
  uid: string,
  onGoal: (target: number | undefined) => void,
  onError: (error: Error) => void,
  database: Firestore = db,
): () => void {
  return onSnapshot(
    doc(database, 'users', uid),
    (snapshot) => {
      const target: unknown = snapshot.data()?.monthlyBooksGoal;
      onGoal(typeof target === 'number' ? target : undefined);
    },
    onError,
  );
}
