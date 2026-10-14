/** Lo que se necesita de una sesión para ordenarla (sin depender de Firebase: las marcas son `Timestamp`). */
interface ListedSession {
  id: string;
  date: { toMillis(): number };
  createdAt: { toMillis(): number };
}

/**
 * Orden único de las sesiones en toda la app: la más reciente primero (por la fecha de la sesión) y, si dos caen
 * en el mismo instante, la registrada después primero. El `id` desempata para que el orden sea siempre el mismo.
 * Firestore solo ordena por `date` (un orden compuesto exigiría un índice), así que el desempate se hace aquí.
 */
export function sortSessions<T extends ListedSession>(sessions: readonly T[]): T[] {
  return [...sessions].sort(
    (a, b) => b.date.toMillis() - a.date.toMillis() || b.createdAt.toMillis() - a.createdAt.toMillis() || a.id.localeCompare(b.id),
  );
}

/** Las sesiones de un libro, en el mismo orden en que llegan. */
export function sessionsOfBook<T extends { bookId: string }>(sessions: readonly T[], bookId: string): T[] {
  return sessions.filter((session) => session.bookId === bookId);
}
