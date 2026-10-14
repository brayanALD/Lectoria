import { useMemo } from 'react';

import { useReadingData } from '../context/ReadingDataContext';
import type { ReadingSessionWithId } from '../types/session';

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
 * Sesiones de lectura del usuario autenticado en tiempo real (misma fuente que `useBooks`: la suscripción de
 * `ReadingDataProvider`). Los resúmenes por día y las rachas se leen de `useReadingStats`, no se recalculan.
 */
export function useSessions(): UseSessionsResult {
  const { sessions } = useReadingData();
  return useMemo(
    () => ({ sessions: sessions.items, loading: sessions.loading, error: sessions.error, retry: sessions.retry }),
    [sessions],
  );
}
