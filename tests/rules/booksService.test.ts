/**
 * @jest-environment node
 */
import { assertFails, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setLogLevel,
  Timestamp,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';

import type { BookFormValues, UserBook, UserBookWithId } from '../../src/types/book';
import { EMPTY_BOOK_FORM, parseBookForm } from '../../src/utils/book';
import {
  changeBookStatus,
  createBook,
  deleteBook,
  subscribeToBooks,
  updateBookDetails,
} from '../../src/services/booksService';

// El servicio importa db de firebaseConfig (React Native); en las pruebas se le pasa el Firestore del emulador.
jest.mock('../../firebaseConfig', () => ({ db: {}, auth: {} }));

// Requiere el emulador de Firestore: npm run test:rules
setLogLevel('silent');

let env: RulesTestEnvironment;
// El emulador tipa su Firestore como el de la API compatible; en ejecución es el mismo objeto de la API modular.
const alice = () => env.authenticatedContext('alice').firestore() as unknown as Firestore;
const bob = () => env.authenticatedContext('bob').firestore() as unknown as Firestore;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-lectoria',
    firestore: { rules: readFileSync(join(__dirname, '../../firestore.rules'), 'utf8') },
  });
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
});

/** Crea un libro a través del formulario, como lo hará la app. */
async function create(values: Partial<BookFormValues> = {}, database = alice()): Promise<string> {
  const result = parseBookForm({ ...EMPTY_BOOK_FORM, title: 'Dune', authors: 'Frank Herbert', ...values });
  if (!result.ok) throw new Error(`formulario inválido: ${JSON.stringify(result.errors)}`);
  return createBook('alice', result.data, database);
}

async function read(id: string): Promise<UserBookWithId> {
  const snapshot = await getDoc(doc(alice(), 'users/alice/books', id));
  if (!snapshot.exists()) throw new Error('el libro no existe');
  return { id, ...(snapshot.data() as UserBook) };
}

const validSession = (bookId: string) => ({
  bookId,
  date: Timestamp.now(),
  dateKey: '2026-10-12',
  pagesRead: 10,
  durationMinutes: 15,
  createdAt: serverTimestamp(),
});

async function addSessions(bookId: string, count: number, prefix: string): Promise<void> {
  await env.withSecurityRulesDisabled(async (context) => {
    const database = context.firestore();
    for (let start = 0; start < count; start += 400) {
      const batch = writeBatch(database);
      for (let i = start; i < Math.min(start + 400, count); i++) {
        batch.set(doc(database, 'users/alice/sessions', `${prefix}-${i}`), validSession(bookId));
      }
      await batch.commit();
    }
  });
}

const countSessions = async () => (await getDocs(collection(alice(), 'users/alice/sessions'))).size;

describe('createBook', () => {
  it('crea el libro con fechas del servidor y valores por defecto', async () => {
    const book = await read(await create());
    expect(book).toMatchObject({ title: 'Dune', authors: ['Frank Herbert'], status: 'want_to_read', acquisition: 'owned', currentPage: 0 });
    expect(book.createdAt).toBeInstanceOf(Timestamp);
    expect(book.updatedAt).toBeInstanceOf(Timestamp);
    expect(book.startedAt).toBeUndefined();
    expect(book.finishedAt).toBeUndefined();
  });

  it('un libro creado como terminado queda en la última página con fechas de inicio y fin', async () => {
    const book = await read(await create({ status: 'finished', pageCount: '412' }));
    expect(book.currentPage).toBe(412);
    expect(book.startedAt).toBeInstanceOf(Timestamp);
    expect(book.finishedAt).toBeInstanceOf(Timestamp);
  });

  it('un libro creado como «leyendo» fija solo la fecha de inicio', async () => {
    const book = await read(await create({ status: 'reading' }));
    expect(book.startedAt).toBeInstanceOf(Timestamp);
    expect(book.finishedAt).toBeUndefined();
  });

  it('un usuario no puede crear libros en la biblioteca de otro', async () => {
    await assertFails(create({}, bob()));
  });
});

describe('subscribeToBooks', () => {
  const nextBooks = (database = alice(), until: (books: UserBookWithId[]) => boolean = () => true) =>
    new Promise<UserBookWithId[]>((resolve, reject) => {
      const unsubscribe = subscribeToBooks(
        'alice',
        (books) => {
          if (until(books)) {
            unsubscribe();
            resolve(books);
          }
        },
        reject,
        database,
      );
    });

  it('devuelve una lista vacía cuando no hay libros', async () => {
    expect(await nextBooks()).toEqual([]);
  });

  it('devuelve los libros con su id y ordenados del más reciente al más antiguo', async () => {
    const first = await create({ title: 'Primero' });
    await new Promise((resolve) => setTimeout(resolve, 50));
    const second = await create({ title: 'Segundo' });

    const books = await nextBooks(alice(), (list) => list.length === 2);
    expect(books.map((book) => book.id)).toEqual([second, first]);
    expect(books[0].createdAt).toBeInstanceOf(Timestamp);
  });

  it('un usuario no puede leer la biblioteca de otro', async () => {
    await create();
    await expect(nextBooks(bob())).rejects.toBeDefined();
  });
});

describe('updateBookDetails', () => {
  it('actualiza los datos y elimina los campos opcionales que se vaciaron', async () => {
    const id = await create({ seriesName: 'Dune Chronicles', seriesOrder: '1', genres: 'Ciencia ficción', pageCount: '412' });
    const result = parseBookForm({ ...EMPTY_BOOK_FORM, title: 'Dune (edición revisada)', authors: 'Frank Herbert; Brian Herbert' });
    if (!result.ok) throw new Error('formulario inválido');

    await updateBookDetails('alice', await read(id), result.data, alice());

    const book = await read(id);
    expect(book.title).toBe('Dune (edición revisada)');
    expect(book.authors).toEqual(['Frank Herbert', 'Brian Herbert']);
    for (const field of ['seriesName', 'seriesOrder', 'genres', 'pageCount'] as const) expect(book[field]).toBeUndefined();
    expect(book.createdAt).toBeInstanceOf(Timestamp);
  });

  it('guarda el ISBN y la portada del catálogo, y los elimina si se vacían', async () => {
    const id = await create({ isbn13: '0-306-40615-2', coverUrl: 'https://covers.openlibrary.org/b/id/1-M.jpg' });
    const created = await read(id);
    expect(created.isbn13).toBe('9780306406157');
    expect(created.coverUrl).toBe('https://covers.openlibrary.org/b/id/1-M.jpg');

    const result = parseBookForm({ ...EMPTY_BOOK_FORM, title: 'Dune', authors: 'Frank Herbert' });
    if (!result.ok) throw new Error('formulario inválido');
    await updateBookDetails('alice', created, result.data, alice());

    const edited = await read(id);
    expect(edited.isbn13).toBeUndefined();
    expect(edited.coverUrl).toBeUndefined();
  });

  it('no cambia el estado de lectura ni el progreso', async () => {
    const id = await create({ status: 'reading', pageCount: '400' });
    const before = await read(id);
    const result = parseBookForm({ ...EMPTY_BOOK_FORM, title: 'Otro título', authors: 'Otro', pageCount: '400', status: 'want_to_read' });
    if (!result.ok) throw new Error('formulario inválido');

    await updateBookDetails('alice', before, result.data, alice());

    const after = await read(id);
    expect(after.status).toBe('reading');
    expect(after.currentPage).toBe(before.currentPage);
    expect(after.startedAt).toEqual(before.startedAt);
  });

  it('recorta el progreso si el nuevo total de páginas es menor', async () => {
    const id = await create({ status: 'reading', pageCount: '400' });
    await env.withSecurityRulesDisabled(async (context) => {
      await writeBatch(context.firestore()).set(doc(context.firestore(), 'users/alice/books', id), { currentPage: 250 }, { merge: true }).commit();
    });
    const result = parseBookForm({ ...EMPTY_BOOK_FORM, title: 'Dune', authors: 'Frank Herbert', pageCount: '200' });
    if (!result.ok) throw new Error('formulario inválido');

    await updateBookDetails('alice', await read(id), result.data, alice());
    expect((await read(id)).currentPage).toBe(200);
  });
});

describe('changeBookStatus', () => {
  it('empezar a leer fija la fecha de inicio', async () => {
    const id = await create();
    await changeBookStatus('alice', await read(id), 'reading', alice());
    const book = await read(id);
    expect(book.status).toBe('reading');
    expect(book.startedAt).toBeInstanceOf(Timestamp);
  });

  it('reabrir un libro terminado borra la fecha de fin y conserva el progreso', async () => {
    const id = await create({ status: 'finished', pageCount: '300' });
    await changeBookStatus('alice', await read(id), 'reading', alice());
    const book = await read(id);
    expect(book.status).toBe('reading');
    expect(book.finishedAt).toBeUndefined();
    expect(book.currentPage).toBe(300);
  });

  it('no escribe nada si el estado no cambia', async () => {
    const id = await create({ status: 'reading' });
    const before = await read(id);
    await changeBookStatus('alice', before, 'reading', alice());
    expect((await read(id)).updatedAt).toEqual(before.updatedAt);
  });

  it('un usuario no puede cambiar el estado de un libro ajeno', async () => {
    const id = await create();
    await assertFails(changeBookStatus('alice', await read(id), 'reading', bob()));
  });
});

describe('deleteBook', () => {
  it('elimina el libro y todas sus sesiones, y solo las suyas', async () => {
    const id = await create();
    const other = await create({ title: 'Otro libro' });
    await addSessions(id, 3, 'a');
    await addSessions(other, 2, 'b');

    expect(await deleteBook('alice', id, alice())).toBe(3);

    expect((await getDoc(doc(alice(), 'users/alice/books', id))).exists()).toBe(false);
    expect((await getDoc(doc(alice(), 'users/alice/books', other))).exists()).toBe(true);
    expect(await countSessions()).toBe(2);
  });

  it('elimina un libro sin sesiones', async () => {
    const id = await create();
    expect(await deleteBook('alice', id, alice())).toBe(0);
    expect((await getDoc(doc(alice(), 'users/alice/books', id))).exists()).toBe(false);
  });

  it('elimina más sesiones de las que caben en un lote (450)', async () => {
    const id = await create();
    await addSessions(id, 450, 'many');
    expect(await deleteBook('alice', id, alice())).toBe(450);
    expect(await countSessions()).toBe(0);
  });

  it('un usuario no puede eliminar los libros ni las sesiones de otro', async () => {
    const id = await create();
    await addSessions(id, 2, 'a');
    await assertFails(deleteBook('alice', id, bob()));
    expect((await getDoc(doc(alice(), 'users/alice/books', id))).exists()).toBe(true);
    expect(await countSessions()).toBe(2);
  });
});
