import { useCallback } from 'react';

import { useAuth } from '../context/AuthContext';
import { setDailyGoal } from '../services/userService';
import type { DailyGoal } from '../types/goal';
import { withTimeout } from '../utils/withTimeout';

// Sin conexión, una escritura de Firestore no termina hasta recuperar la red: se corta la espera.
const WRITE_TIMEOUT_MS = 10000;

/**
 * Guarda la meta diaria del usuario actual (o la quita con `undefined`). Es lo que reciben `DailyGoalSheet` en
 * Inicio y en Estadísticas, para que las dos pantallas guarden igual. Si falla, lanza el error para que la hoja lo muestre.
 */
export function useSaveDailyGoal(): (goal: DailyGoal | undefined) => Promise<void> {
  const { user } = useAuth();
  const uid = user?.uid;
  return useCallback(
    async (goal) => {
      if (!uid) throw new Error('No hay sesión iniciada');
      await withTimeout(setDailyGoal(uid, goal), WRITE_TIMEOUT_MS);
    },
    [uid],
  );
}
