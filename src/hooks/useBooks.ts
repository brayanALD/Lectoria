import { useMemo } from 'react';

import { useReadingData } from '../context/ReadingDataContext';
import type { UserBookWithId } from '../types/book';

interface UseBooksResult {
  /** Biblioteca del usuario actual, del libro más reciente al más antiguo. */
  books: UserBookWithId[];
  /** true hasta que llega la primera respuesta. Una biblioteca vacía NO es «cargando». */
  loading: boolean;
  /** Mensaje para el usuario si la suscripción falló; null si todo va bien. */
  error: string | null;
  /** Vuelve a suscribirse tras un error. */
  retry: () => void;
}

/**
 * Biblioteca del usuario autenticado en tiempo real. No abre una suscripción propia: lee la de
 * `ReadingDataProvider`, que es la misma para todas las pantallas, se actualiza sola cuando cambian los datos y se
 * reinicia si cambia el usuario. Los filtros y la búsqueda se aplican en la pantalla sobre `books`.
 */
export function useBooks(): UseBooksResult {
  const { books } = useReadingData();
  return useMemo(
    () => ({ books: books.items, loading: books.loading, error: books.error, retry: books.retry }),
    [books],
  );
}
