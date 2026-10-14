import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState, type ReactNode } from 'react';

import { subscribeToBooks } from '../services/booksService';
import { subscribeToSessions } from '../services/sessionsService';
import type { UserBookWithId } from '../types/book';
import type { ReadingSessionWithId } from '../types/session';
import { getFirestoreErrorMessage } from '../utils/firestoreErrors';
import { initialListState, listReducer } from '../utils/listState';
import { getReadingDays, summarizeByDay, type DaySummary } from '../utils/readingDays';
import { useAuth } from './AuthContext';

/** Una lista en tiempo real tal como la consume la interfaz. */
interface LiveList<T> {
  items: T[];
  /** true hasta que llega la primera respuesta. Una lista vacía NO es «cargando». */
  loading: boolean;
  /** Mensaje para el usuario si la suscripción falló; null si todo va bien. */
  error: string | null;
  /** Vuelve a suscribirse tras un error. */
  retry: () => void;
}

interface ReadingDataValue {
  books: LiveList<UserBookWithId>;
  sessions: LiveList<ReadingSessionWithId>;
  /** Minutos y páginas por día (`dateKey`), derivados de las sesiones. */
  days: Map<string, DaySummary>;
  /** Días que cuentan como «día de lectura», derivados de las sesiones. */
  readingDays: Set<string>;
}

const ReadingDataContext = createContext<ReadingDataValue | undefined>(undefined);

/**
 * Única fuente de datos de lectura de la app: UNA suscripción a los libros y UNA a las sesiones del usuario
 * (se reinician si cambia el usuario). Inicio, Biblioteca, Calendario, el detalle del libro y el registro de
 * lecturas leen todos de aquí, así que crear, editar o eliminar una sesión o un libro se refleja a la vez en todas
 * las pantallas, sin parpadeos de carga al navegar y sin recalcular los mismos resúmenes en cada una.
 * Va dentro de `AuthProvider` y antes del navegador.
 */
export function ReadingDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user?.uid;

  const [booksState, dispatchBooks] = useReducer(listReducer<UserBookWithId>, initialListState<UserBookWithId>());
  const [sessionsState, dispatchSessions] = useReducer(
    listReducer<ReadingSessionWithId>,
    initialListState<ReadingSessionWithId>(),
  );
  const [booksAttempt, setBooksAttempt] = useState(0);
  const [sessionsAttempt, setSessionsAttempt] = useState(0);

  useEffect(() => {
    if (!uid) {
      dispatchBooks({ type: 'idle' });
      return;
    }
    dispatchBooks({ type: 'subscribe' });
    return subscribeToBooks(
      uid,
      (items) => dispatchBooks({ type: 'success', items }),
      (error) => dispatchBooks({ type: 'failure', message: getFirestoreErrorMessage(error) }),
    );
  }, [uid, booksAttempt]);

  useEffect(() => {
    if (!uid) {
      dispatchSessions({ type: 'idle' });
      return;
    }
    dispatchSessions({ type: 'subscribe' });
    return subscribeToSessions(
      uid,
      (items) => dispatchSessions({ type: 'success', items }),
      (error) => dispatchSessions({ type: 'failure', message: getFirestoreErrorMessage(error) }),
    );
  }, [uid, sessionsAttempt]);

  const retryBooks = useCallback(() => setBooksAttempt((count) => count + 1), []);
  const retrySessions = useCallback(() => setSessionsAttempt((count) => count + 1), []);

  const days = useMemo(() => summarizeByDay(sessionsState.items), [sessionsState.items]);
  const readingDays = useMemo(() => getReadingDays(sessionsState.items), [sessionsState.items]);

  const value = useMemo<ReadingDataValue>(
    () => ({
      books: { ...booksState, retry: retryBooks },
      sessions: { ...sessionsState, retry: retrySessions },
      days,
      readingDays,
    }),
    [booksState, sessionsState, retryBooks, retrySessions, days, readingDays],
  );

  return <ReadingDataContext.Provider value={value}>{children}</ReadingDataContext.Provider>;
}

/** Acceso al contexto; las pantallas usan `useBooks`, `useSessions`, `useBook` y `useReadingStats`. */
export function useReadingData(): ReadingDataValue {
  const value = useContext(ReadingDataContext);
  if (!value) throw new Error('useReadingData debe usarse dentro de ReadingDataProvider');
  return value;
}
