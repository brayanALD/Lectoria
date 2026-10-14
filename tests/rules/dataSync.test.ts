/**
 * @jest-environment node
 */
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { setLogLevel, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';

import { changeBookStatus, createBook, deleteBook, subscribeToBooks } from '../../src/services/booksService';
import {
  adjustBookProgress,
  createSession,
  deleteSession,
  subscribeToSessions,
  updateSession,
} from '../../src/services/sessionsService';
import type { UserBookWithId } from '../../src/types/book';
import type { ReadingSessionWithId, SessionFormValues } from '../../src/types/session';
import { EMPTY_BOOK_FORM, parseBookForm } from '../../src/utils/book';
import { initialListState, listReducer, type ListState } from '../../src/utils/listState';
import { addDays, computeStreaks, getReadingDays, summarizeByDay } from '../../src/utils/readingDays';
import { parseSessionForm, toDateKey } from '../../src/utils/session';

// El servicio importa db de firebaseConfig (React Native); en las pruebas se le pasa el Firestore del emulador.
jest.mock('../../firebaseConfig', () => ({ db: {}, auth: {} }));

// Requiere el emulador de Firestore: npm run test:rules
setLogLevel('silent');

/**
 * Comprueba la promesa de la app: que Inicio, Biblioteca, Calendario y el detalle del libro, que leen todos de las
 * mismas dos suscripciones (`ReadingDataProvider`), reflejan a la vez cada creación, edición y eliminación de una
 * sesión, sin ajustes manuales. Aquí se abren esas dos suscripciones con los mismos reductores y resúmenes que usa el
 * proveedor, y se espera a que la vista se ponga al día tras cada operación.
 */
let env: RulesTestEnvironment;
let database: Firestore;

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
  // Una sola instancia para escribir y escuchar, como en la app.
  database = env.authenticatedContext('alice').firestore() as unknown as Firestore;
});

interface LiveView {
  books: UserBookWithId[];
  sessions: ReadingSessionWithId[];
  days: ReturnType<typeof summarizeByDay>;
  readingDays: Set<string>;
  streaks: ReturnType<typeof computeStreaks>;
}

const TODAY = toDateKey(new Date());

/** Las dos suscripciones del proveedor, con los mismos reductores y derivados. */
function openLiveView() {
  let booksState: ListState<UserBookWithId> = initialListState<UserBookWithId>();
  let sessionsState: ListState<ReadingSessionWithId> = initialListState<ReadingSessionWithId>();
  const waiting = new Set<() => void>();
  const notify = () => waiting.forEach((check) => check());

  const stopBooks = subscribeToBooks(
    'alice',
    (items) => {
      booksState = listReducer(booksState, { type: 'success', items });
      notify();
    },
    (error) => {
      throw error;
    },
    database,
  );
  const stopSessions = subscribeToSessions(
    'alice',
    (items) => {
      sessionsState = listReducer(sessionsState, { type: 'success', items });
      notify();
    },
    (error) => {
      throw error;
    },
    database,
  );

  const snapshot = (): LiveView => {
    const readingDays = getReadingDays(sessionsState.items);
    return {
      books: booksState.items,
      sessions: sessionsState.items,
      days: summarizeByDay(sessionsState.items),
      readingDays,
      streaks: computeStreaks(readingDays, TODAY),
    };
  };

  return {
    /** Espera a que ambas listas hayan llegado y la vista cumpla la condición; devuelve la vista resultante. */
    until(predicate: (view: LiveView) => boolean): Promise<LiveView> {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          waiting.delete(check);
          reject(new Error(`La vista no se puso al día: ${JSON.stringify(summary(snapshot()))}`));
        }, 8000);
        const check = () => {
          if (booksState.loading || sessionsState.loading) return;
          const view = snapshot();
          if (!predicate(view)) return;
          clearTimeout(timer);
          waiting.delete(check);
          resolve(view);
        };
        waiting.add(check);
        check();
      });
    },
    close() {
      stopBooks();
      stopSessions();
    },
  };
}

function summary(view: LiveView) {
  return {
    books: view.books.map((book) => ({ title: book.title, page: book.currentPage, status: book.status })),
    sessions: view.sessions.map((session) => ({ day: session.dateKey, end: session.endPage, min: session.durationMinutes })),
  };
}

/**
 * Invariante de la app: sin correcciones manuales hacia atrás, la página de cada libro es la página final más alta de
 * sus sesiones (0 si no tiene ninguna). Es lo que garantiza que Biblioteca, detalle y Calendario cuenten lo mismo.
 */
function expectBooksMatchSessions(view: LiveView) {
  for (const book of view.books) {
    const ends = view.sessions.filter((session) => session.bookId === book.id).map((session) => session.endPage ?? 0);
    expect({ title: book.title, page: book.currentPage }).toEqual({ title: book.title, page: Math.max(0, ...ends) });
  }
}

async function addBook(title = 'Dune'): Promise<UserBookWithId> {
  const result = parseBookForm({ ...EMPTY_BOOK_FORM, title, authors: 'Frank Herbert', pageCount: '300', status: 'reading' });
  if (!result.ok) throw new Error('libro inválido');
  const id = await createBook('alice', result.data, database);
  const view = await live.until((current) => current.books.some((book) => book.id === id));
  return view.books.find((book) => book.id === id) as UserBookWithId;
}

function sessionFields(book: UserBookWithId, values: Partial<SessionFormValues>) {
  const result = parseSessionForm({ date: new Date(), minutes: '', startPage: '', endPage: '', notes: '', ...values }, book.id, book);
  if (!result.ok) throw new Error(`sesión inválida: ${JSON.stringify(result.errors)}`);
  return result.data;
}

const daysAgo = (count: number) => new Date(Date.now() - count * 24 * 60 * 60 * 1000);

let live: ReturnType<typeof openLiveView>;
beforeEach(() => {
  live = openLiveView();
});
afterEach(() => {
  live.close();
});

describe('sincronización entre secciones', () => {
  it('crear una sesión actualiza a la vez sesiones, libro, días y racha', async () => {
    const book = await addBook();
    await createSession('alice', book, sessionFields(book, { minutes: '30', endPage: '80' }), database);

    const view = await live.until((current) => current.sessions.length === 1 && current.books[0].currentPage === 80);
    expect(view.days.get(TODAY)).toMatchObject({ minutes: 30, pages: 80, isReadingDay: true });
    expect(view.readingDays.has(TODAY)).toBe(true);
    expect(view.streaks).toEqual({ current: 1, longest: 1 });
    expectBooksMatchSessions(view);
  });

  it('editar una sesión (páginas, minutos y notas) se refleja en todas las vistas', async () => {
    const book = await addBook();
    await createSession('alice', book, sessionFields(book, { minutes: '30', endPage: '80' }), database);
    const created = await live.until((current) => current.sessions.length === 1 && current.books[0].currentPage === 80);

    const session = created.sessions[0];
    await updateSession(
      'alice',
      session,
      sessionFields(created.books[0], { minutes: '45', startPage: '0', endPage: '120', notes: 'corregida' }),
      created.books[0],
      created.sessions,
      database,
    );

    const view = await live.until((current) => current.books[0].currentPage === 120 && current.sessions[0].durationMinutes === 45);
    expect(view.sessions[0]).toMatchObject({ endPage: 120, pagesRead: 120, notes: 'corregida' });
    expect(view.days.get(TODAY)).toMatchObject({ minutes: 45, pages: 120 });
    expectBooksMatchSessions(view);
  });

  it('mover una sesión de día cambia el calendario y la racha sin tocar el libro', async () => {
    const book = await addBook();
    await createSession('alice', book, sessionFields(book, { minutes: '30', endPage: '80' }), database);
    const created = await live.until((current) => current.sessions.length === 1 && current.books[0].currentPage === 80);

    const twoDaysAgo = addDays(TODAY, -2);
    await updateSession(
      'alice',
      created.sessions[0],
      { ...sessionFields(created.books[0], { minutes: '30', startPage: '0', endPage: '80', date: daysAgo(2) }), dateKey: twoDaysAgo },
      created.books[0],
      created.sessions,
      database,
    );

    const view = await live.until((current) => current.readingDays.has(twoDaysAgo));
    expect(view.readingDays.has(TODAY)).toBe(false);
    expect(view.days.has(TODAY)).toBe(false);
    expect(view.streaks).toEqual({ current: 0, longest: 1 });
    expect(view.books[0].currentPage).toBe(80);
    expectBooksMatchSessions(view);
  });

  it('eliminar una sesión devuelve libro, días y racha a su estado anterior, sin ajustar nada a mano', async () => {
    const book = await addBook();
    await createSession('alice', book, sessionFields(book, { minutes: '20', endPage: '80', date: daysAgo(1) }), database);
    const first = await live.until((current) => current.sessions.length === 1 && current.books[0].currentPage === 80);

    await createSession('alice', first.books[0], sessionFields(first.books[0], { minutes: '25', endPage: '150' }), database);
    const both = await live.until((current) => current.sessions.length === 2 && current.books[0].currentPage === 150);
    expect(both.streaks).toEqual({ current: 2, longest: 2 });

    const latest = both.sessions.find((session) => session.endPage === 150) as ReadingSessionWithId;
    await deleteSession('alice', latest, both.books[0], both.sessions, database);

    const view = await live.until((current) => current.sessions.length === 1);
    expect(view.books[0].currentPage).toBe(80);
    expect(view.days.has(TODAY)).toBe(false);
    // Ayer sigue contando: la racha se mantiene hasta que acabe hoy.
    expect(view.streaks).toEqual({ current: 1, longest: 1 });
    expectBooksMatchSessions(view);
  });

  it('eliminar la sesión que terminó el libro lo reabre en todas las vistas', async () => {
    const book = await addBook();
    await createSession('alice', book, sessionFields(book, { endPage: '100' }), database);
    const first = await live.until((current) => current.books[0].currentPage === 100);
    await createSession('alice', first.books[0], sessionFields(first.books[0], { endPage: '300' }), database);
    const finished = await live.until((current) => current.books[0].status === 'finished');

    const last = finished.sessions.find((session) => session.endPage === 300) as ReadingSessionWithId;
    await deleteSession('alice', last, finished.books[0], finished.sessions, database);

    const view = await live.until((current) => current.sessions.length === 1 && current.books[0].status === 'reading');
    expect(view.books[0].currentPage).toBe(100);
    expectBooksMatchSessions(view);
  });

  it('el ajuste manual hacia delante también aparece como sesión en el calendario', async () => {
    const book = await addBook();
    await adjustBookProgress('alice', book, 60, new Date(), database);

    const view = await live.until((current) => current.sessions.length === 1 && current.books[0].currentPage === 60);
    expect(view.days.get(TODAY)).toMatchObject({ pages: 60, minutes: 0, isReadingDay: true });
    expectBooksMatchSessions(view);
  });

  it('cada libro se mantiene aparte aunque compartan la lista de sesiones', async () => {
    const dune = await addBook('Dune');
    const emma = await addBook('Emma');
    await createSession('alice', dune, sessionFields(dune, { endPage: '90' }), database);
    await createSession('alice', emma, sessionFields(emma, { endPage: '40' }), database);
    const both = await live.until((current) => current.sessions.length === 2 && current.books.every((book) => book.currentPage > 0));

    const duneSession = both.sessions.find((session) => session.bookId === dune.id) as ReadingSessionWithId;
    const duneNow = both.books.find((book) => book.id === dune.id) as UserBookWithId;
    await deleteSession('alice', duneSession, duneNow, both.sessions, database);

    const view = await live.until((current) => current.sessions.length === 1);
    expect(view.books.find((book) => book.id === dune.id)?.currentPage).toBe(0);
    expect(view.books.find((book) => book.id === emma.id)?.currentPage).toBe(40);
    expectBooksMatchSessions(view);
  });

  it('eliminar un libro elimina sus sesiones de Calendario, Inicio y estadísticas', async () => {
    const book = await addBook();
    await createSession('alice', book, sessionFields(book, { minutes: '30', endPage: '80' }), database);
    await live.until((current) => current.sessions.length === 1);

    await deleteBook('alice', book.id, database);

    const view = await live.until((current) => current.books.length === 0 && current.sessions.length === 0);
    expect(view.days.size).toBe(0);
    expect(view.streaks).toEqual({ current: 0, longest: 0 });
  });

  it('cambiar el estado del libro no altera sus sesiones ni los días de lectura', async () => {
    const book = await addBook();
    await createSession('alice', book, sessionFields(book, { minutes: '30', endPage: '80' }), database);
    const created = await live.until((current) => current.sessions.length === 1 && current.books[0].currentPage === 80);

    await changeBookStatus('alice', created.books[0], 'paused', database);

    const view = await live.until((current) => current.books[0].status === 'paused');
    expect(view.sessions).toHaveLength(1);
    expect(view.readingDays.has(TODAY)).toBe(true);
  });
});
