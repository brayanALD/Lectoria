// Contrato entre los servicios de la app y la API: qué método, ruta y cuerpo se envía en cada operación. Lo que cubre
// `tests/rules/dataSync.test.ts` de punta a punta (sesiones, estado, compra, metas…) no se repite aquí al detalle.
jest.mock('../../firebaseConfig', () => ({ db: {}, auth: {} }));
// Las suscripciones (no se prueban aquí) importan Firestore, que en el entorno de React Native no se puede cargar.
jest.mock('firebase/firestore', () => ({ collection: jest.fn(), doc: jest.fn(), onSnapshot: jest.fn(), orderBy: jest.fn(), query: jest.fn() }));
jest.mock('./apiClient', () => ({
  api: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

import { deleteAccountData } from './accountService';
import { api } from './apiClient';
import { findBookByIsbn } from './bookCatalogService';
import {
  changeBookStatus,
  createBook,
  deleteBook,
  saveBookNotes,
  saveBookReview,
  savePurchase,
  updateBookDetails,
} from './booksService';
import {
  createFilterCollection,
  createManualCollection,
  deleteCollection,
  updateCollection,
} from './collectionsService';
import type { NewBookFields } from '../types/book';
import { adjustBookProgress, createSession, deleteSession, finishBook, updateSession } from './sessionsService';
import { ensureUserProfile, setDailyGoal, setMonthlyBooksGoal } from './userService';

// Las funciones simuladas del cliente de la API (ver el `jest.mock` de arriba).
const mockApi = api as unknown as Record<'get' | 'post' | 'put' | 'patch' | 'delete', jest.Mock>;

beforeEach(() => {
  for (const method of Object.values(mockApi)) method.mockReset();
});

const bookFields: NewBookFields = { title: 'Dune', authors: ['Frank Herbert'], status: 'reading', acquisition: 'owned', currentPage: 0 };

describe('libros', () => {
  it('crear envía los campos con el requestId y devuelve el id', async () => {
    mockApi.post.mockResolvedValue({ id: 'abc', repeated: false });
    await expect(createBook(bookFields, 'req-12345678')).resolves.toBe('abc');
    expect(mockApi.post).toHaveBeenCalledWith('/v1/books', { ...bookFields, requestId: 'req-12345678' });
  });

  it('editar, cambiar de estado, comprar, notas y reseña usan la ruta de su libro', async () => {
    await updateBookDetails('b/1', bookFields);
    expect(mockApi.patch).toHaveBeenCalledWith('/v1/books/b%2F1', bookFields);

    await changeBookStatus('b1', 'paused');
    expect(mockApi.put).toHaveBeenLastCalledWith('/v1/books/b1/status', { status: 'paused' });

    const purchasedAt = new Date('2026-10-10T17:00:00Z');
    await savePurchase('b1', { purchasedAt, price: 45000 });
    expect(mockApi.put).toHaveBeenLastCalledWith('/v1/books/b1/purchase', { purchasedAt: '2026-10-10T17:00:00.000Z', price: 45000 });

    await saveBookNotes('b1', 'una nota');
    expect(mockApi.put).toHaveBeenLastCalledWith('/v1/books/b1/notes', { notes: 'una nota' });
    await saveBookNotes('b1', undefined);
    expect(mockApi.put).toHaveBeenLastCalledWith('/v1/books/b1/notes', { notes: '' });

    const review = { rating: 4.5, review: 'Muy bueno', specificReviews: [{ topic: 'Trama', text: 'Sólida' }] };
    await saveBookReview('b1', review);
    expect(mockApi.put).toHaveBeenLastCalledWith('/v1/books/b1/review', review);
  });

  it('eliminar devuelve cuántas sesiones se borraron', async () => {
    mockApi.delete.mockResolvedValue({ deletedSessions: 3 });
    await expect(deleteBook('b1')).resolves.toBe(3);
    expect(mockApi.delete.mock.calls[0][0]).toBe('/v1/books/b1');
  });
});

describe('sesiones', () => {
  const fields = {
    bookId: 'b1',
    date: new Date('2026-10-13T15:00:00Z'),
    dateKey: '2026-10-13',
    startPage: 10,
    endPage: 40,
    pagesRead: 30,
    durationMinutes: 25,
    notes: 'bien',
  };

  it('crear envía solo lo que el servidor no calcula (ni páginas leídas ni día) y la zona horaria', async () => {
    mockApi.post.mockResolvedValue({ id: 'timer-1', repeated: false });
    await expect(createSession(fields, 'timer-1')).resolves.toBe('timer-1');
    const [path, body] = mockApi.post.mock.calls[0];
    expect(path).toBe('/v1/sessions');
    expect(body).toMatchObject({
      bookId: 'b1',
      date: '2026-10-13T15:00:00.000Z',
      durationMinutes: 25,
      startPage: 10,
      endPage: 40,
      notes: 'bien',
      requestId: 'timer-1',
    });
    expect(typeof body.timeZone).toBe('string');
    expect(body).not.toHaveProperty('pagesRead');
    expect(body).not.toHaveProperty('dateKey');
  });

  it('editar conserva el día elegido (dateKey) y no cambia de libro', async () => {
    await updateSession('s1', fields);
    const [path, body] = mockApi.put.mock.calls[0];
    expect(path).toBe('/v1/sessions/s1');
    expect(body).toMatchObject({ dateKey: '2026-10-13', durationMinutes: 25 });
    expect(body).not.toHaveProperty('bookId');
  });

  it('eliminar, terminar y ajustar el progreso solo mandan lo necesario', async () => {
    await deleteSession('s1');
    expect(mockApi.delete).toHaveBeenCalledWith('/v1/sessions/s1');

    await finishBook('b1');
    expect(mockApi.post).toHaveBeenLastCalledWith('/v1/books/b1/finish', { timeZone: expect.any(String) });

    await adjustBookProgress('b1', 60);
    expect(mockApi.post).toHaveBeenLastCalledWith('/v1/books/b1/progress', { page: 60, timeZone: expect.any(String) });
  });
});

describe('colecciones', () => {
  it('crea manuales y estanterías con su tipo, y devuelve el id', async () => {
    mockApi.post.mockResolvedValue({ id: 'c1' });
    await expect(createManualCollection('Favoritos', ['a', 'b'], 'req-aaaaaaaa')).resolves.toBe('c1');
    expect(mockApi.post).toHaveBeenLastCalledWith('/v1/collections', {
      kind: 'manual',
      name: 'Favoritos',
      bookIds: ['a', 'b'],
      requestId: 'req-aaaaaaaa',
    });

    const filters = { acquisition: 'owned', genre: 'Fantasía' } as const;
    await expect(createFilterCollection('Fantasía', filters)).resolves.toBe('c1');
    expect(mockApi.post).toHaveBeenLastCalledWith('/v1/collections', { kind: 'filter', name: 'Fantasía', filters, requestId: undefined });
  });

  it('edita y elimina por su ruta', async () => {
    await updateCollection('c1', { name: 'Nuevo', bookIds: ['a'] });
    expect(mockApi.patch).toHaveBeenCalledWith('/v1/collections/c1', { name: 'Nuevo', bookIds: ['a'] });
    await deleteCollection('c1');
    expect(mockApi.delete).toHaveBeenCalledWith('/v1/collections/c1');
  });
});

describe('perfil, metas y cuenta', () => {
  it('el perfil sale del registro, o de la cuenta si no hay datos del formulario', async () => {
    await ensureUserProfile({ displayName: 'Cuenta Google', email: 'a@b.c' } as never, { displayName: ' Ana ', nickname: ' Ani ' });
    expect(mockApi.post).toHaveBeenLastCalledWith('/v1/me/profile', {
      displayName: 'Ana',
      nickname: 'Ani',
      timeZone: expect.any(String),
    });

    await ensureUserProfile({ displayName: ' Cuenta Google ', email: 'a@b.c' } as never);
    expect(mockApi.post).toHaveBeenLastCalledWith('/v1/me/profile', {
      displayName: 'Cuenta Google',
      nickname: undefined,
      timeZone: expect.any(String),
    });
  });

  it('fija y quita las metas', async () => {
    await setDailyGoal({ type: 'pages', target: 20 });
    expect(mockApi.put).toHaveBeenLastCalledWith('/v1/me/daily-goal', { type: 'pages', target: 20 });
    await setDailyGoal(undefined);
    expect(mockApi.delete).toHaveBeenLastCalledWith('/v1/me/daily-goal');

    await setMonthlyBooksGoal(4);
    expect(mockApi.put).toHaveBeenLastCalledWith('/v1/me/monthly-goal', { target: 4 });
    await setMonthlyBooksGoal(undefined);
    expect(mockApi.delete).toHaveBeenLastCalledWith('/v1/me/monthly-goal');
  });

  it('borrar los datos de la cuenta espera más que una escritura normal', async () => {
    await deleteAccountData();
    expect(mockApi.delete).toHaveBeenCalledWith('/v1/me/data', { timeoutMs: 90_000 });
  });
});

describe('catálogo por ISBN', () => {
  const book = { isbn13: '9780306406157', title: 'Dune', authors: ['Frank Herbert'] };

  it('devuelve el libro, o null si ningún catálogo lo conoce', async () => {
    mockApi.get.mockResolvedValueOnce({ book });
    await expect(findBookByIsbn('9780306406157')).resolves.toEqual(book);
    expect(mockApi.get.mock.calls[0][0]).toBe('/v1/catalog/isbn/9780306406157');

    mockApi.get.mockResolvedValueOnce({ book: null });
    await expect(findBookByIsbn('9780306406157')).resolves.toBeNull();
  });

  it('conserva los errores del catálogo y convierte cualquier otro fallo en «no disponible»', async () => {
    mockApi.get.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'lectoria/catalog-rate-limited' }));
    await expect(findBookByIsbn('9780306406157')).rejects.toMatchObject({ code: 'lectoria/catalog-rate-limited' });

    mockApi.get.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'lectoria/server-unavailable' }));
    await expect(findBookByIsbn('9780306406157')).rejects.toMatchObject({ code: 'lectoria/catalog-unavailable' });

    mockApi.get.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'unavailable' }));
    await expect(findBookByIsbn('9780306406157')).rejects.toMatchObject({ code: 'lectoria/catalog-unavailable' });
  });
});
