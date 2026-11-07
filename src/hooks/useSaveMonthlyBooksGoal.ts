import { useCallback } from 'react';

import { useAuth } from '../context/AuthContext';
import { setMonthlyBooksGoal } from '../services/userService';
import { withTimeout } from '../utils/withTimeout';

// Sin conexión (o con el servidor despertando) la petición no termina enseguida: se corta la espera.
const WRITE_TIMEOUT_MS = 10000;

/**
 * Guarda el objetivo mensual de libros del usuario actual (o lo quita con `undefined`). Si falla, lanza el error para
 * que la hoja lo muestre.
 */
export function useSaveMonthlyBooksGoal(): (target: number | undefined) => Promise<void> {
  const { user } = useAuth();
  const uid = user?.uid;
  return useCallback(
    async (target) => {
      if (!uid) throw new Error('No hay sesión iniciada');
      await withTimeout(setMonthlyBooksGoal(target), WRITE_TIMEOUT_MS);
    },
    [uid],
  );
}
