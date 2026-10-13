import { useCallback, useEffect, useReducer, useState } from 'react';

import { useAuth } from '../context/AuthContext';
import { subscribeToBooks } from '../services/booksService';
import type { UserBookWithId } from '../types/book';
import { INITIAL_BOOKS_STATE, booksReducer } from '../utils/booksState';
import { getFirestoreErrorMessage } from '../utils/firestoreErrors';

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
 * Biblioteca del usuario autenticado en tiempo real. Se suscribe al montar, se actualiza sola cuando
 * cambian los datos, se cancela al desmontar y se reinicia si cambia el usuario.
 * Los filtros y la búsqueda se aplican en la pantalla sobre `books`.
 */
export function useBooks(): UseBooksResult {
  const { user } = useAuth();
  const uid = user?.uid;
  const [state, dispatch] = useReducer(booksReducer, INITIAL_BOOKS_STATE);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!uid) {
      dispatch({ type: 'idle' });
      return;
    }
    dispatch({ type: 'subscribe' });
    return subscribeToBooks(
      uid,
      (books) => dispatch({ type: 'success', books }),
      (error) => dispatch({ type: 'failure', message: getFirestoreErrorMessage(error) }),
    );
  }, [uid, attempt]);

  const retry = useCallback(() => setAttempt((count) => count + 1), []);

  return { books: state.books, loading: state.loading, error: state.error, retry };
}
