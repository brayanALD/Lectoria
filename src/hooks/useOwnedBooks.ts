import { useMemo } from 'react';

import type { UserBookWithId } from '../types/book';
import { filterByAcquisition } from '../utils/bookFilters';
import { useBooks } from './useBooks';

/**
 * Solo los libros propios del usuario (no los de la lista de deseos). Es lo que se puede leer: Inicio, el registro de
 * lecturas y el cronómetro usan esta lista, porque un deseo todavía no se tiene. Misma forma que `useBooks`.
 */
export function useOwnedBooks(): {
  books: UserBookWithId[];
  loading: boolean;
  error: string | null;
  retry: () => void;
} {
  const { books, loading, error, retry } = useBooks();
  const owned = useMemo(() => filterByAcquisition(books, 'owned'), [books]);
  return useMemo(() => ({ books: owned, loading, error, retry }), [owned, loading, error, retry]);
}
