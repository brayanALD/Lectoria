import { doc, onSnapshot, type Firestore } from 'firebase/firestore';

import { db } from '../../firebaseConfig';
import type { DailyGoal } from '../types/goal';
import type { ProfileInput } from '../types/user';
import { api } from './apiClient';
import type { User } from './authService';

// El perfil `users/{uid}` se LEE directo de Firestore (suscripciones de las metas) y se ESCRIBE por la API. El parámetro
// `database` de las suscripciones permite probarlas contra el emulador; en la app siempre se usa `db`.

/**
 * Crea `users/{uid}` si no existe (el servidor lo hace de forma idempotente: se puede llamar en cada inicio de sesión).
 * El nombre sale de `input` (registro con correo) o, si no hay, de la cuenta (p. ej. Google) o del correo. La zona
 * horaria alimenta el cálculo del día de cada sesión (rachas y calendario). Es la única operación que crea el perfil.
 */
export async function ensureUserProfile(user: User, input?: ProfileInput): Promise<void> {
  await api.post('/v1/me/profile', {
    displayName: input?.displayName.trim() || user.displayName?.trim() || undefined,
    nickname: input?.nickname?.trim() || undefined,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC',
  });
}

// La meta diaria vive en el perfil, en un campo según su tipo: `dailyGoalMinutes` (1–1440) o `dailyGoalPages`
// (1–10000), nunca los dos. Solo actualiza esos campos en un perfil que `ensureUserProfile` ya creó.

/** Fija la meta diaria, o la quita si `goal` es `undefined`. Cambiar de tipo es una sola escritura en el servidor. */
export async function setDailyGoal(goal: DailyGoal | undefined): Promise<void> {
  if (goal) await api.put('/v1/me/daily-goal', goal);
  else await api.delete('/v1/me/daily-goal');
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

// El objetivo mensual en libros vive en el mismo perfil, en `monthlyBooksGoal` (entero de 1 a 1000). Como la meta
// diaria, solo actualiza ese campo en un perfil que `ensureUserProfile` ya creó.

/** Fija el objetivo mensual de libros, o lo quita si `target` es `undefined`. */
export async function setMonthlyBooksGoal(target: number | undefined): Promise<void> {
  if (target !== undefined) await api.put('/v1/me/monthly-goal', { target });
  else await api.delete('/v1/me/monthly-goal');
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
