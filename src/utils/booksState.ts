import type { UserBookWithId } from '../types/book';

/** Estado de la biblioteca que consume la interfaz: cargando, con datos o con error. */
export interface BooksState {
  books: UserBookWithId[];
  /** true hasta recibir la primera respuesta de Firestore. */
  loading: boolean;
  error: string | null;
}

export type BooksAction =
  | { type: 'subscribe' }
  | { type: 'idle' }
  | { type: 'success'; books: UserBookWithId[] }
  | { type: 'failure'; message: string };

export const INITIAL_BOOKS_STATE: BooksState = { books: [], loading: true, error: null };

export function booksReducer(state: BooksState, action: BooksAction): BooksState {
  switch (action.type) {
    // Nueva suscripción (primer uso, cambio de usuario o reintento): se vacía la lista para no mostrar
    // nunca los libros de otro usuario mientras llegan los nuevos.
    case 'subscribe':
      return INITIAL_BOOKS_STATE;
    // Sin sesión: no hay nada que cargar.
    case 'idle':
      return { books: [], loading: false, error: null };
    case 'success':
      return { books: action.books, loading: false, error: null };
    // Ante un error se conservan los últimos libros recibidos, por si ya se estaban mostrando.
    case 'failure':
      return { ...state, loading: false, error: action.message };
  }
}
