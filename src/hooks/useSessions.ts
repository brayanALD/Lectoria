import { useCallback, useEffect, useReducer, useState } from 'react';

import { useAuth } from '../context/AuthContext';
import { subscribeToSessions } from '../services/sessionsService';
import type { ReadingSessionWithId } from '../types/session';
import { getFirestoreErrorMessage } from '../utils/firestoreErrors';
import { initialListState, listReducer } from '../utils/listState';

interface UseSessionsResult {
  /** Todas las sesiones del usuario actual, de la más reciente a la más antigua. */
  sessions: ReadingSessionWithId[];
  /** true hasta que llega la primera respuesta. Sin sesiones registradas NO es «cargando». */
  loading: boolean;
  /** Mensaje para el usuario si la suscripción falló; null si todo va bien. */
  error: string | null;
  /** Vuelve a suscribirse tras un error. */
  retry: () => void;
}

/**
 * Sesiones de lectura del usuario autenticado en tiempo real (misma mecánica que `useBooks`). El calendario,
 * las rachas y las estadísticas se calculan en la pantalla sobre `sessions`.
 */
export function useSessions(): UseSessionsResult {
  const { user } = useAuth();
  const uid = user?.uid;
  const [state, dispatch] = useReducer(listReducer<ReadingSessionWithId>, initialListState<ReadingSessionWithId>());
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!uid) {
      dispatch({ type: 'idle' });
      return;
    }
    dispatch({ type: 'subscribe' });
    return subscribeToSessions(
      uid,
      (items) => dispatch({ type: 'success', items }),
      (error) => dispatch({ type: 'failure', message: getFirestoreErrorMessage(error) }),
    );
  }, [uid, attempt]);

  const retry = useCallback(() => setAttempt((count) => count + 1), []);

  return { sessions: state.items, loading: state.loading, error: state.error, retry };
}
