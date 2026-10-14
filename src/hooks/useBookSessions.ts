import { useMemo } from 'react';

import type { ReadingSessionWithId } from '../types/session';
import { totalsForSessions } from '../utils/readingStats';
import { sessionsOfBook } from '../utils/sessionList';
import { useSessions } from './useSessions';

interface UseBookSessionsResult {
  /** Las sesiones del libro, de la más reciente a la más antigua. */
  sessions: ReadingSessionWithId[];
  /** Tiempo y páginas leídas en total, y número de sesiones. */
  totals: { minutes: number; pages: number; sessions: number };
  loading: boolean;
  error: string | null;
  retry: () => void;
}

/** Las sesiones de un libro y sus totales, derivados de la lista única de sesiones (`useSessions`). */
export function useBookSessions(bookId: string): UseBookSessionsResult {
  const all = useSessions();
  const sessions = useMemo(() => sessionsOfBook(all.sessions, bookId), [all.sessions, bookId]);
  const totals = useMemo(() => totalsForSessions(sessions), [sessions]);
  return { sessions, totals, loading: all.loading, error: all.error, retry: all.retry };
}
