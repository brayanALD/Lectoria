import { useMemo } from 'react';

import type { UserBookWithId } from '../types/book';
import { useBooks } from './useBooks';

interface UseBookResult {
  /** El libro, o undefined si no existe (p. ej. se eliminó). Solo es fiable cuando `loading` es false. */
  book: UserBookWithId | undefined;
  /** Toda la biblioteca (misma suscripción), p. ej. para sugerir sagas ya registradas al editar. */
  books: UserBookWithId[];
  loading: boolean;
  error: string | null;
  retry: () => void;
}

/**
 * Un libro de la biblioteca del usuario, en tiempo real. Se deriva de `useBooks` (la suscripción única de
 * `ReadingDataProvider`), así que el detalle se actualiza solo cuando cambia el libro o sus sesiones.
 */
export function useBook(bookId: string): UseBookResult {
  const { books, loading, error, retry } = useBooks();
  const book = useMemo(() => books.find((candidate) => candidate.id === bookId), [books, bookId]);
  return { book, books, loading, error, retry };
}
