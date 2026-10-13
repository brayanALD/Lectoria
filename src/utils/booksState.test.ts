import type { UserBookWithId } from '../types/book';
import { INITIAL_BOOKS_STATE, booksReducer, type BooksState } from './booksState';

const book = (id: string) => ({ id, title: `Libro ${id}` }) as unknown as UserBookWithId;

describe('booksReducer', () => {
  it('empieza cargando, sin libros ni error', () => {
    expect(INITIAL_BOOKS_STATE).toEqual({ books: [], loading: true, error: null });
  });

  it('success guarda los libros y deja de cargar', () => {
    const state = booksReducer(INITIAL_BOOKS_STATE, { type: 'success', books: [book('a'), book('b')] });
    expect(state).toEqual({ books: [book('a'), book('b')], loading: false, error: null });
  });

  it('una biblioteca vacía es un éxito, no un estado de carga', () => {
    expect(booksReducer(INITIAL_BOOKS_STATE, { type: 'success', books: [] })).toEqual({
      books: [],
      loading: false,
      error: null,
    });
  });

  it('failure guarda el mensaje, deja de cargar y conserva los últimos libros', () => {
    const loaded: BooksState = { books: [book('a')], loading: false, error: null };
    expect(booksReducer(loaded, { type: 'failure', message: 'Sin conexión.' })).toEqual({
      books: [book('a')],
      loading: false,
      error: 'Sin conexión.',
    });
  });

  it('un error antes de recibir datos deja la lista vacía y sin cargar', () => {
    expect(booksReducer(INITIAL_BOOKS_STATE, { type: 'failure', message: 'x' })).toEqual({
      books: [],
      loading: false,
      error: 'x',
    });
  });

  it('subscribe vacía los libros y limpia el error, para no mostrar datos de otro usuario ni errores viejos', () => {
    const failed: BooksState = { books: [book('de-otro-usuario')], loading: false, error: 'Error anterior' };
    expect(booksReducer(failed, { type: 'subscribe' })).toEqual({ books: [], loading: true, error: null });
  });

  it('idle (sin sesión) vacía todo y no queda cargando', () => {
    const loaded: BooksState = { books: [book('a')], loading: false, error: null };
    expect(booksReducer(loaded, { type: 'idle' })).toEqual({ books: [], loading: false, error: null });
  });

  it('success tras un error limpia el error (p. ej. al recuperar la conexión)', () => {
    const failed: BooksState = { books: [], loading: false, error: 'Sin conexión.' };
    expect(booksReducer(failed, { type: 'success', books: [book('a')] }).error).toBeNull();
  });
});
