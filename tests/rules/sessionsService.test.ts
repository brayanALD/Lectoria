/**
 * @jest-environment node
 */
import { assertFails, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, setLogLevel, Timestamp, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';

import { createBook } from '../../src/services/booksService';
import { createSession, deleteSession, subscribeToSessions } from '../../src/services/sessionsService';
import type { BookFormValues, UserBook, UserBookWithId } from '../../src/types/book';
import type { ReadingSession, ReadingSessionWithId, SessionFormValues } from '../../src/types/session';
import { EMPTY_BOOK_FORM, parseBookForm } from '../../src/utils/book';
import { parseSessionForm } from '../../src/utils/session';

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

async function createTestBook(values: Partial<BookFormValues> = {}): Promise<UserBookWithId> {
  const result = parseBookForm({ ...EMPTY_BOOK_FORM, title: 'Dune', authors: 'Frank Herbert', pageCount: '300', ...values });
  if (!result.ok) throw new Error(`libro inválido: ${JSON.stringify(result.errors)}`);
  const id = await createBook('alice', result.data, alice());
  return readBook(id);
}

async function readBook(id: string): Promise<UserBookWithId> {
  const snapshot = await getDoc(doc(alice(), 'users/alice/books', id));
  return { id, ...(snapshot.data() as UserBook) };
}

/** Pasa por el formulario, como hará la app (misma validación y mismos datos que acepta la regla). */
function buildSession(book: UserBookWithId, values: Partial<SessionFormValues> = {}) {
  const result = parseSessionForm(
    { date: new Date(), minutes: '', startPage: '', endPage: '', notes: '', ...values },
    book.id,
    book,
  );
  if (!result.ok) throw new Error(`sesión inválida: ${JSON.stringify(result.errors)}`);
  return result.data;
}

describe('createSession', () => {
  it('guarda la sesión con todos sus campos y marcas del servidor', async () => {
    const book = await createTestBook({ status: 'reading' });
    const id = await createSession('alice', book, buildSession(book, { minutes: '30', endPage: '40', notes: 'Buen capítulo' }), alice());

    const snapshot = await getDoc(doc(alice(), 'users/alice/sessions', id));
    const session = snapshot.data() as ReadingSession;
    expect(session).toMatchObject({
      bookId: book.id,
      pagesRead: 40,
      durationMinutes: 30,
      startPage: 0,
      endPage: 40,
      notes: 'Buen capítulo',
    });
    expect(session.dateKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(session.date).toBeInstanceOf(Timestamp);
    expect(session.createdAt).toBeInstanceOf(Timestamp);
  });

  it('actualiza la página actual del libro en la misma operación', async () => {
    const book = await createTestBook({ status: 'reading' });
    await createSession('alice', book, buildSession(book, { endPage: '120' }), alice());
    expect((await readBook(book.id)).currentPage).toBe(120);
  });

  it('una sesión solo con minutos no cambia la página del libro', async () => {
    const book = await createTestBook({ status: 'reading' });
    await createSession('alice', book, buildSession(book, { minutes: '25' }), alice());
    const after = await readBook(book.id);
    expect(after.currentPage).toBe(0);
    expect(after.updatedAt).toEqual(book.updatedAt); // no se escribió el libro
  });

  it('un libro pendiente pasa a «Leyendo» con fecha de inicio', async () => {
    const book = await createTestBook({ status: 'want_to_read' });
    await createSession('alice', book, buildSession(book, { endPage: '10' }), alice());
    const after = await readBook(book.id);
    expect(after.status).toBe('reading');
    expect(after.startedAt).toBeInstanceOf(Timestamp);
  });

  it('al llegar a la última página el libro pasa a «Terminado» con fecha de fin', async () => {
    const book = await createTestBook({ status: 'reading' });
    await createSession('alice', book, buildSession(book, { endPage: '300' }), alice());
    const after = await readBook(book.id);
    expect(after).toMatchObject({ status: 'finished', currentPage: 300 });
    expect(after.finishedAt).toBeInstanceOf(Timestamp);
  });

  it('una sesión con fecha pasada y página menor no hace retroceder el libro', async () => {
    const book = await createTestBook({ status: 'reading' });
    await createSession('alice', book, buildSession(book, { endPage: '200' }), alice());
    const advanced = await readBook(book.id);

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const older = parseSessionForm(
      { date: yesterday, minutes: '20', startPage: '10', endPage: '60', notes: '' },
      advanced.id,
      advanced,
    );
    if (!older.ok) throw new Error('sesión inválida');
    await createSession('alice', advanced, older.data, alice());

    expect((await readBook(book.id)).currentPage).toBe(200);
  });

  it('un usuario no puede registrar sesiones en la cuenta de otro, y no se escribe nada', async () => {
    const book = await createTestBook({ status: 'reading' });
    await assertFails(createSession('alice', book, buildSession(book, { endPage: '50' }), bob()));
    expect((await getDocs(collection(alice(), 'users/alice/sessions'))).size).toBe(0);
    expect((await readBook(book.id)).currentPage).toBe(0);
  });
});

describe('deleteSession', () => {
  it('elimina la sesión sin tocar el libro', async () => {
    const book = await createTestBook({ status: 'reading' });
    const id = await createSession('alice', book, buildSession(book, { endPage: '80' }), alice());

    await deleteSession('alice', id, alice());

    expect((await getDoc(doc(alice(), 'users/alice/sessions', id))).exists()).toBe(false);
    expect((await readBook(book.id)).currentPage).toBe(80);
  });

  it('un usuario no puede eliminar las sesiones de otro', async () => {
    const book = await createTestBook({ status: 'reading' });
    const id = await createSession('alice', book, buildSession(book, { minutes: '10' }), alice());
    await assertFails(deleteSession('alice', id, bob()));
    expect((await getDoc(doc(alice(), 'users/alice/sessions', id))).exists()).toBe(true);
  });
});

describe('subscribeToSessions', () => {
  const next = (database: Firestore, until: (sessions: ReadingSessionWithId[]) => boolean = () => true) =>
    new Promise<ReadingSessionWithId[]>((resolve, reject) => {
      const unsubscribe = subscribeToSessions(
        'alice',
        (sessions) => {
          if (until(sessions)) {
            unsubscribe();
            resolve(sessions);
          }
        },
        reject,
        database,
      );
    });

  it('devuelve una lista vacía si no hay sesiones', async () => {
    expect(await next(alice())).toEqual([]);
  });

  it('devuelve las sesiones con su id, de la más reciente a la más antigua', async () => {
    const book = await createTestBook({ status: 'reading' });
    const older = await createSession(
      'alice',
      book,
      buildSession(book, { minutes: '10', date: new Date(Date.now() - 2 * 60 * 60 * 1000) }),
      alice(),
    );
    const newer = await createSession('alice', book, buildSession(book, { minutes: '20' }), alice());

    const sessions = await next(alice(), (list) => list.length === 2);
    expect(sessions.map((session) => session.id)).toEqual([newer, older]);
    expect(sessions[0].createdAt).toBeInstanceOf(Timestamp);
  });

  it('un usuario no puede leer las sesiones de otro', async () => {
    await expect(next(bob())).rejects.toBeDefined();
  });
});
