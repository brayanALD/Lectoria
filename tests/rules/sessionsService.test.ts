/**
 * @jest-environment node
 */
import { assertFails, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, setLogLevel, Timestamp, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';

import { createBook } from '../../src/services/booksService';
import {
  adjustBookProgress,
  createSession,
  deleteSession,
  subscribeToSessions,
  updateSession,
} from '../../src/services/sessionsService';
import type { BookFormValues, UserBook, UserBookWithId } from '../../src/types/book';
import type { ReadingSession, ReadingSessionWithId, SessionFormValues } from '../../src/types/session';
import { EMPTY_BOOK_FORM, parseBookForm } from '../../src/utils/book';
import { isReadingSession, parseSessionForm, toDateKey } from '../../src/utils/session';

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

async function readSession(id: string): Promise<ReadingSessionWithId> {
  const snapshot = await getDoc(doc(alice(), 'users/alice/sessions', id));
  return { id, ...(snapshot.data() as ReadingSession) };
}

/** Todas las sesiones, como las entrega `subscribeToSessions` a la app. */
async function readSessions(): Promise<ReadingSessionWithId[]> {
  const snapshot = await getDocs(collection(alice(), 'users/alice/sessions'));
  return snapshot.docs.map((document) => ({ id: document.id, ...(document.data() as ReadingSession) }));
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

/** Registra una lectura hasta `endPage` partiendo de la página actual del libro y devuelve el libro y la sesión al día. */
async function readUntil(bookId: string, endPage: string, extra: Partial<SessionFormValues> = {}) {
  const book = await readBook(bookId);
  const id = await createSession('alice', book, buildSession(book, { endPage, ...extra }), alice());
  return { book: await readBook(bookId), session: await readSession(id) };
}

describe('deleteSession', () => {
  const sessionExists = async (id: string) => (await getDoc(doc(alice(), 'users/alice/sessions', id))).exists();

  it('elimina la sesión que fijaba la página y el libro vuelve a la lectura anterior', async () => {
    const { id } = await createTestBook({ status: 'reading' });
    await readUntil(id, '80');
    const { book, session } = await readUntil(id, '150');
    expect(book.currentPage).toBe(150);

    await deleteSession('alice', session, book, await readSessions(), alice());

    expect(await sessionExists(session.id)).toBe(false);
    expect((await readBook(id)).currentPage).toBe(80);
  });

  it('eliminar la única sesión con páginas devuelve el libro a la página 0', async () => {
    const { id } = await createTestBook({ status: 'reading' });
    const { book, session } = await readUntil(id, '80');

    await deleteSession('alice', session, book, await readSessions(), alice());

    expect((await readBook(id)).currentPage).toBe(0);
    expect(await readSessions()).toEqual([]);
  });

  it('eliminar una sesión que no fijaba la página no escribe el libro', async () => {
    const { id } = await createTestBook({ status: 'reading' });
    const first = await readUntil(id, '80');
    const { book } = await readUntil(id, '150');

    await deleteSession('alice', first.session, book, await readSessions(), alice());

    const after = await readBook(id);
    expect(after.currentPage).toBe(150);
    expect(after.updatedAt).toEqual(book.updatedAt);
  });

  it('eliminar una sesión solo con minutos no toca el libro', async () => {
    const { id } = await createTestBook({ status: 'reading' });
    await readUntil(id, '80');
    const book = await readBook(id);
    const minutesId = await createSession('alice', book, buildSession(book, { minutes: '25' }), alice());

    await deleteSession('alice', await readSession(minutesId), book, await readSessions(), alice());

    const after = await readBook(id);
    expect(after.currentPage).toBe(80);
    expect(after.updatedAt).toEqual(book.updatedAt);
    expect(await sessionExists(minutesId)).toBe(false);
  });

  it('eliminar la sesión que terminó el libro lo reabre en «Leyendo» sin fecha de fin', async () => {
    const { id } = await createTestBook({ status: 'reading' });
    await readUntil(id, '100');
    const { book, session } = await readUntil(id, '300');
    expect(book).toMatchObject({ status: 'finished', currentPage: 300 });

    await deleteSession('alice', session, book, await readSessions(), alice());

    const after = await readBook(id);
    expect(after).toMatchObject({ status: 'reading', currentPage: 100 });
    expect(after.finishedAt).toBeUndefined();
  });

  it('solo se tienen en cuenta las sesiones del mismo libro', async () => {
    const dune = await createTestBook({ status: 'reading' });
    const other = await createTestBook({ title: 'Emma', status: 'reading' });
    await readUntil(other.id, '250');
    const { book, session } = await readUntil(dune.id, '80');

    await deleteSession('alice', session, book, await readSessions(), alice());

    expect((await readBook(dune.id)).currentPage).toBe(0);
    expect((await readBook(other.id)).currentPage).toBe(250);
  });

  it('si el libro ya no existe, solo se elimina la sesión', async () => {
    const { id } = await createTestBook({ status: 'reading' });
    const { session } = await readUntil(id, '80');

    await deleteSession('alice', session, undefined, await readSessions(), alice());

    expect(await sessionExists(session.id)).toBe(false);
  });

  it('un usuario no puede eliminar las sesiones de otro, y no se toca ni la sesión ni el libro', async () => {
    const { id } = await createTestBook({ status: 'reading' });
    const { book, session } = await readUntil(id, '80');

    await assertFails(deleteSession('alice', session, book, await readSessions(), bob()));

    expect(await sessionExists(session.id)).toBe(true);
    expect((await readBook(id)).currentPage).toBe(80);
  });
});

describe('updateSession', () => {
  /** Los campos de la sesión editada: parten de la sesión actual y cambian solo lo indicado. */
  function edit(book: UserBookWithId, session: ReadingSessionWithId, values: Partial<SessionFormValues>) {
    return buildSession(book, {
      date: session.date.toDate(),
      minutes: session.durationMinutes ? String(session.durationMinutes) : '',
      startPage: session.startPage !== undefined ? String(session.startPage) : '',
      endPage: session.endPage !== undefined ? String(session.endPage) : '',
      notes: session.notes ?? '',
      ...values,
    });
  }

  it('subir la página final de la sesión que fijaba el progreso avanza el libro', async () => {
    const { id } = await createTestBook({ status: 'reading' });
    const { book, session } = await readUntil(id, '80');

    await updateSession('alice', session, edit(book, session, { endPage: '120' }), book, await readSessions(), alice());

    expect(await readSession(session.id)).toMatchObject({ startPage: 0, endPage: 120, pagesRead: 120 });
    expect((await readBook(id)).currentPage).toBe(120);
  });

  it('bajar la página final de la sesión que fijaba el progreso hace retroceder el libro', async () => {
    const { id } = await createTestBook({ status: 'reading' });
    const { book, session } = await readUntil(id, '80');

    await updateSession('alice', session, edit(book, session, { endPage: '50' }), book, await readSessions(), alice());

    expect((await readSession(session.id)).pagesRead).toBe(50);
    expect((await readBook(id)).currentPage).toBe(50);
  });

  it('bajar la página final nunca deja el libro por debajo de otra sesión anterior', async () => {
    const { id } = await createTestBook({ status: 'reading' });
    await readUntil(id, '80');
    const { book, session } = await readUntil(id, '150');

    await updateSession('alice', session, edit(book, session, { startPage: '80', endPage: '90' }), book, await readSessions(), alice());

    expect((await readBook(id)).currentPage).toBe(90);

    const lowered = await readBook(id);
    const latest = await readSession(session.id);
    await updateSession('alice', latest, edit(lowered, latest, { startPage: '10', endPage: '20' }), lowered, await readSessions(), alice());
    expect((await readBook(id)).currentPage).toBe(80);
  });

  it('quitar la página final elimina esos campos y devuelve el libro a la lectura anterior', async () => {
    const { id } = await createTestBook({ status: 'reading' });
    await readUntil(id, '80');
    const { book, session } = await readUntil(id, '150', { minutes: '30' });

    await updateSession('alice', session, edit(book, session, { startPage: '', endPage: '' }), book, await readSessions(), alice());

    const stored = (await getDoc(doc(alice(), 'users/alice/sessions', session.id))).data() as ReadingSession;
    expect(stored).toMatchObject({ durationMinutes: 30, pagesRead: 0 });
    expect(stored).not.toHaveProperty('startPage');
    expect(stored).not.toHaveProperty('endPage');
    expect((await readBook(id)).currentPage).toBe(80);
  });

  it('editar solo minutos y notas no escribe el libro', async () => {
    const { id } = await createTestBook({ status: 'reading' });
    const { book, session } = await readUntil(id, '80', { minutes: '10', notes: 'antes' });

    await updateSession('alice', session, edit(book, session, { minutes: '45', notes: 'después' }), book, await readSessions(), alice());

    expect(await readSession(session.id)).toMatchObject({ durationMinutes: 45, notes: 'después' });
    const after = await readBook(id);
    expect(after.currentPage).toBe(80);
    expect(after.updatedAt).toEqual(book.updatedAt);
  });

  it('vaciar las notas elimina el campo', async () => {
    const { id } = await createTestBook({ status: 'reading' });
    const { book, session } = await readUntil(id, '80', { notes: 'algo' });

    await updateSession('alice', session, edit(book, session, { notes: '' }), book, await readSessions(), alice());

    expect((await getDoc(doc(alice(), 'users/alice/sessions', session.id))).data()).not.toHaveProperty('notes');
  });

  it('cambiar la fecha actualiza el día de la sesión y conserva cuándo se creó', async () => {
    const { id } = await createTestBook({ status: 'reading' });
    const { book, session } = await readUntil(id, '80');
    const earlier = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    await updateSession('alice', session, edit(book, session, { date: earlier }), book, await readSessions(), alice());

    const after = await readSession(session.id);
    expect(after.dateKey).toBe(toDateKey(earlier));
    expect(after.dateKey).not.toBe(session.dateKey);
    expect(after.createdAt).toEqual(session.createdAt);
  });

  it('subir hasta la última página termina el libro, y bajarla lo reabre', async () => {
    const { id } = await createTestBook({ status: 'reading' });
    const { book, session } = await readUntil(id, '80');

    await updateSession('alice', session, edit(book, session, { endPage: '300' }), book, await readSessions(), alice());
    const finished = await readBook(id);
    expect(finished).toMatchObject({ status: 'finished', currentPage: 300 });
    expect(finished.finishedAt).toBeInstanceOf(Timestamp);

    const latest = await readSession(session.id);
    await updateSession('alice', latest, edit(finished, latest, { endPage: '200' }), finished, await readSessions(), alice());
    const reopened = await readBook(id);
    expect(reopened).toMatchObject({ status: 'reading', currentPage: 200 });
    expect(reopened.finishedAt).toBeUndefined();
  });

  it('una sesión que no fijaba el progreso solo lo mueve si lo supera', async () => {
    const { id } = await createTestBook({ status: 'reading' });
    const first = await readUntil(id, '80');
    const { book } = await readUntil(id, '150');

    // La primera sesión sube a 120: no supera la página 150, el libro no cambia.
    await updateSession('alice', first.session, edit(book, first.session, { endPage: '120' }), book, await readSessions(), alice());
    expect((await readBook(id)).currentPage).toBe(150);

    // Ahora la sube a 200: supera la página del libro y la mueve.
    const again = await readSession(first.session.id);
    await updateSession('alice', again, edit(book, again, { endPage: '200' }), book, await readSessions(), alice());
    expect((await readBook(id)).currentPage).toBe(200);
  });

  it('un usuario no puede editar las sesiones de otro, y no se toca ni la sesión ni el libro', async () => {
    const { id } = await createTestBook({ status: 'reading' });
    const { book, session } = await readUntil(id, '80');

    await assertFails(updateSession('alice', session, edit(book, session, { endPage: '10' }), book, await readSessions(), bob()));

    expect((await readSession(session.id)).endPage).toBe(80);
    expect((await readBook(id)).currentPage).toBe(80);
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

describe('adjustBookProgress', () => {
  const sessionCount = async () => (await getDocs(collection(alice(), 'users/alice/sessions'))).size;

  it('hacia delante registra una sesión de páginas sin minutos y avanza el libro', async () => {
    const book = await createTestBook({ status: 'reading' });
    await adjustBookProgress('alice', book, 50, new Date(), alice());

    const sessions = await getDocs(collection(alice(), 'users/alice/sessions'));
    expect(sessions.size).toBe(1);
    expect(sessions.docs[0].data()).toMatchObject({ bookId: book.id, pagesRead: 50, durationMinutes: 0, startPage: 0, endPage: 50 });
    expect((await readBook(book.id)).currentPage).toBe(50);
  });

  it('un avance de más de 1 página cuenta como día de lectura', async () => {
    const book = await createTestBook({ status: 'reading' });
    await adjustBookProgress('alice', book, 5, new Date(), alice());
    const data = (await getDocs(collection(alice(), 'users/alice/sessions'))).docs[0].data() as ReadingSession;
    expect(isReadingSession(data)).toBe(true);
  });

  it('un avance de exactamente 1 página se registra pero no cuenta como día de lectura', async () => {
    const book = await createTestBook({ status: 'reading' });
    await adjustBookProgress('alice', book, 1, new Date(), alice());
    const data = (await getDocs(collection(alice(), 'users/alice/sessions'))).docs[0].data() as ReadingSession;
    expect(data.pagesRead).toBe(1);
    expect(isReadingSession(data)).toBe(false);
  });

  it('hasta la última página termina el libro', async () => {
    const book = await createTestBook({ status: 'reading' });
    await adjustBookProgress('alice', book, 300, new Date(), alice());
    expect(await readBook(book.id)).toMatchObject({ status: 'finished', currentPage: 300 });
  });

  it('hacia atrás corrige la página sin crear sesión', async () => {
    const book = await createTestBook({ status: 'reading' });
    await adjustBookProgress('alice', book, 120, new Date(), alice());
    const advanced = await readBook(book.id);

    await adjustBookProgress('alice', advanced, 80, new Date(), alice());

    expect((await readBook(book.id)).currentPage).toBe(80);
    expect(await sessionCount()).toBe(1); // solo la del avance
  });

  it('corregir hacia atrás un libro terminado lo devuelve a «Leyendo» sin fecha de fin', async () => {
    const book = await createTestBook({ status: 'reading' });
    await adjustBookProgress('alice', book, 300, new Date(), alice());
    const finished = await readBook(book.id);
    expect(finished.status).toBe('finished');

    await adjustBookProgress('alice', finished, 250, new Date(), alice());

    const after = await readBook(book.id);
    expect(after).toMatchObject({ status: 'reading', currentPage: 250 });
    expect(after.finishedAt).toBeUndefined();
  });

  it('la misma página no escribe nada', async () => {
    const book = await createTestBook({ status: 'reading' });
    await adjustBookProgress('alice', book, 0, new Date(), alice());
    expect(await sessionCount()).toBe(0);
    expect((await readBook(book.id)).updatedAt).toEqual(book.updatedAt);
  });

  it('un usuario no puede ajustar el progreso de la cuenta de otro', async () => {
    const book = await createTestBook({ status: 'reading' });
    await assertFails(adjustBookProgress('alice', book, 50, new Date(), bob()));
    await assertFails(adjustBookProgress('alice', { ...book, currentPage: 90 }, 10, new Date(), bob()));
    expect((await readBook(book.id)).currentPage).toBe(0);
  });
});
