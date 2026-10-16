import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { subscribeToBooks } from '../services/booksService';
import { subscribeToSessions } from '../services/sessionsService';
import { subscribeToDailyGoal, subscribeToMonthlyBooksGoal } from '../services/userService';
import type { UserBookWithId } from '../types/book';
import type { DailyGoal } from '../types/goal';
import type { ReadingSessionWithId } from '../types/session';
import { msUntilNextDay } from '../utils/calendar';
import { getFirestoreErrorMessage } from '../utils/firestoreErrors';
import { initialListState, listReducer } from '../utils/listState';
import { getReadingDays, summarizeByDay, type DaySummary } from '../utils/readingDays';
import { toDateKey } from '../utils/session';
import { sortSessions } from '../utils/sessionList';
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
  /** De la más reciente a la más antigua (ver `sortSessions`). */
  sessions: LiveList<ReadingSessionWithId>;
  /** La meta diaria (minutos o páginas): una lista de 0 o 1 elementos (sin meta = vacía). */
  goal: LiveList<DailyGoal>;
  /** El objetivo mensual de libros: una lista de 0 o 1 elementos (sin objetivo = vacía). */
  monthlyGoal: LiveList<number>;
  /** Minutos y páginas por día (`dateKey`), derivados de las sesiones. */
  days: Map<string, DaySummary>;
  /** Días que cuentan como «día de lectura», derivados de las sesiones. */
  readingDays: Set<string>;
  /** «YYYY-MM-DD» de hoy. Cambia solo al llegar la medianoche o al volver a la app: es el «hoy» de toda la app. */
  todayKey: string;
}

const ReadingDataContext = createContext<ReadingDataValue | undefined>(undefined);

/** «Hoy» como clave de día, actualizada a medianoche y al volver a la app (por si estuvo en segundo plano). */
function useTodayKeyState(): string {
  const [todayKey, setTodayKey] = useState(() => toDateKey(new Date()));

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const refresh = () => {
      const now = new Date();
      setTodayKey(toDateKey(now));
      clearTimeout(timeout);
      // Un segundo de margen para que el temporizador no salte justo antes de medianoche.
      timeout = setTimeout(refresh, msUntilNextDay(now) + 1000);
    };
    refresh();
    const subscription = AppState.addEventListener('change', (state) => state === 'active' && refresh());
    return () => {
      clearTimeout(timeout);
      subscription.remove();
    };
  }, []);

  return todayKey;
}

/**
 * Única fuente de datos de lectura de la app: UNA suscripción a los libros, UNA a las sesiones, UNA a la meta
 * diaria y UNA al objetivo mensual de libros del usuario (se reinician si cambia el usuario). Inicio, Biblioteca, Calendario, el detalle del libro, el
 * registro de lecturas y el cronómetro leen todos de aquí, así que crear, editar o eliminar una sesión o un libro se
 * refleja a la vez en todas las pantallas, sin parpadeos de carga al navegar y sin recalcular los mismos resúmenes en
 * cada una. También fija el «hoy» común. Va dentro de `AuthProvider` y antes del navegador.
 */
export function ReadingDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user?.uid;

  const [booksState, dispatchBooks] = useReducer(listReducer<UserBookWithId>, initialListState<UserBookWithId>());
  const [sessionsState, dispatchSessions] = useReducer(
    listReducer<ReadingSessionWithId>,
    initialListState<ReadingSessionWithId>(),
  );
  const [goalState, dispatchGoal] = useReducer(listReducer<DailyGoal>, initialListState<DailyGoal>());
  const [monthlyGoalState, dispatchMonthlyGoal] = useReducer(listReducer<number>, initialListState<number>());
  const [booksAttempt, setBooksAttempt] = useState(0);
  const [sessionsAttempt, setSessionsAttempt] = useState(0);
  const [goalAttempt, setGoalAttempt] = useState(0);
  const [monthlyGoalAttempt, setMonthlyGoalAttempt] = useState(0);
  const todayKey = useTodayKeyState();

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

  useEffect(() => {
    if (!uid) {
      dispatchGoal({ type: 'idle' });
      return;
    }
    dispatchGoal({ type: 'subscribe' });
    return subscribeToDailyGoal(
      uid,
      (goal) => dispatchGoal({ type: 'success', items: goal ? [goal] : [] }),
      (error) => dispatchGoal({ type: 'failure', message: getFirestoreErrorMessage(error) }),
    );
  }, [uid, goalAttempt]);

  useEffect(() => {
    if (!uid) {
      dispatchMonthlyGoal({ type: 'idle' });
      return;
    }
    dispatchMonthlyGoal({ type: 'subscribe' });
    return subscribeToMonthlyBooksGoal(
      uid,
      (target) => dispatchMonthlyGoal({ type: 'success', items: target === undefined ? [] : [target] }),
      (error) => dispatchMonthlyGoal({ type: 'failure', message: getFirestoreErrorMessage(error) }),
    );
  }, [uid, monthlyGoalAttempt]);

  const retryBooks = useCallback(() => setBooksAttempt((count) => count + 1), []);
  const retrySessions = useCallback(() => setSessionsAttempt((count) => count + 1), []);
  const retryGoal = useCallback(() => setGoalAttempt((count) => count + 1), []);
  const retryMonthlyGoal = useCallback(() => setMonthlyGoalAttempt((count) => count + 1), []);

  const sortedSessions = useMemo(() => sortSessions(sessionsState.items), [sessionsState.items]);
  const days = useMemo(() => summarizeByDay(sortedSessions), [sortedSessions]);
  const readingDays = useMemo(() => getReadingDays(sortedSessions), [sortedSessions]);

  const value = useMemo<ReadingDataValue>(
    () => ({
      books: { ...booksState, retry: retryBooks },
      sessions: { ...sessionsState, items: sortedSessions, retry: retrySessions },
      goal: { ...goalState, retry: retryGoal },
      monthlyGoal: { ...monthlyGoalState, retry: retryMonthlyGoal },
      days,
      readingDays,
      todayKey,
    }),
    [
      booksState,
      sessionsState,
      goalState,
      monthlyGoalState,
      sortedSessions,
      retryBooks,
      retrySessions,
      retryGoal,
      retryMonthlyGoal,
      days,
      readingDays,
      todayKey,
    ],
  );

  return <ReadingDataContext.Provider value={value}>{children}</ReadingDataContext.Provider>;
}

/** Acceso al contexto; las pantallas usan `useBooks`, `useSessions`, `useBook`, `useReadingStats`, `useDailyGoal` y `useMonthlyBooksGoal`. */
export function useReadingData(): ReadingDataValue {
  const value = useContext(ReadingDataContext);
  if (!value) throw new Error('useReadingData debe usarse dentro de ReadingDataProvider');
  return value;
}
