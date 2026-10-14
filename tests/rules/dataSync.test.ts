/**
 * @jest-environment node
 */
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, serverTimestamp, setDoc, setLogLevel, type Firestore } from 'firebase/firestore';
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
import { setDailyGoal, subscribeToDailyGoal } from '../../src/services/userService';
import type { UserBookWithId } from '../../src/types/book';
import type { DailyGoal } from '../../src/types/goal';
import type { ReadingSessionWithId, SessionFormValues } from '../../src/types/session';
import { EMPTY_BOOK_FORM, parseBookForm } from '../../src/utils/book';
import { dateForDay } from '../../src/utils/calendar';
import { getGoalProgress } from '../../src/utils/dailyGoal';
import { initialListState, listReducer, type ListState } from '../../src/utils/listState';
import { addDays, computeStreaks, getReadingDays, summarizeByDay } from '../../src/utils/readingDays';
import { totalsForSessions } from '../../src/utils/readingStats';
import { buildTimerDraft, pauseTimer, startTimer } from '../../src/utils/readingTimer';
import { parseSessionForm, toDateKey } from '../../src/utils/session';
import { sessionsOfBook, sortSessions } from '../../src/utils/sessionList';

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
  // El perfil lo crea la app al iniciar sesión; la meta diaria se guarda en él.
  await setDoc(doc(database, 'users', 'alice'), { createdAt: serverTimestamp(), timeZone: 'UTC', displayName: 'Alice' });
});

interface LiveView {
  books: UserBookWithId[];
  sessions: ReadingSessionWithId[];
  days: ReturnType<typeof summarizeByDay>;
  readingDays: Set<string>;
  streaks: ReturnType<typeof computeStreaks>;
  /** La meta diaria, de minutos o de páginas (`undefined` si no hay). */
  goal: DailyGoal | undefined;
}

const TODAY = toDateKey(new Date());

/** Las dos suscripciones del proveedor, con los mismos reductores y derivados. */
function openLiveView() {
  let booksState: ListState<UserBookWithId> = initialListState<UserBookWithId>();
  let sessionsState: ListState<ReadingSessionWithId> = initialListState<ReadingSessionWithId>();
  let goalState: ListState<DailyGoal> = initialListState<DailyGoal>();
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

  const stopGoal = subscribeToDailyGoal(
    'alice',
    (goal) => {
      goalState = listReducer(goalState, { type: 'success', items: goal ? [goal] : [] });
      notify();
    },
    (error) => {
      throw error;
    },
    database,
  );

  // Igual que el proveedor de la app: las sesiones se ordenan con `sortSessions` y de ellas salen los resúmenes.
  const snapshot = (): LiveView => {
    const sessions = sortSessions(sessionsState.items);
    const readingDays = getReadingDays(sessions);
    return {
      books: booksState.items,
      sessions,
      days: summarizeByDay(sessions),
      readingDays,
      streaks: computeStreaks(readingDays, TODAY),
      goal: goalState.items[0],
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
          if (booksState.loading || sessionsState.loading || goalState.loading) return;
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
      stopGoal();
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

describe('detalle del libro', () => {
  it('los totales del libro siguen a sus sesiones al crear, editar y eliminar', async () => {
    const dune = await addBook('Dune');
    const emma = await addBook('Emma');
    await createSession('alice', dune, sessionFields(dune, { minutes: '30', endPage: '50' }), database);
    await createSession('alice', emma, sessionFields(emma, { minutes: '99', endPage: '10' }), database);
    const first = await live.until((current) => current.sessions.length === 2 && current.books.every((book) => book.currentPage > 0));
    const duneTotals = (view: LiveView) => totalsForSessions(sessionsOfBook(view.sessions, dune.id));
    expect(duneTotals(first)).toEqual({ minutes: 30, pages: 50, sessions: 1 });

    const duneNow = first.books.find((book) => book.id === dune.id) as UserBookWithId;
    await createSession('alice', duneNow, sessionFields(duneNow, { minutes: '20', endPage: '90' }), database);
    const second = await live.until((current) => duneTotals(current).sessions === 2);
    expect(duneTotals(second)).toEqual({ minutes: 50, pages: 90, sessions: 2 });

    const latest = second.sessions.find((session) => session.bookId === dune.id && session.endPage === 90) as ReadingSessionWithId;
    const duneLatest = second.books.find((book) => book.id === dune.id) as UserBookWithId;
    await updateSession(
      'alice',
      latest,
      sessionFields(duneLatest, { minutes: '45', startPage: '50', endPage: '90' }),
      duneLatest,
      second.sessions,
      database,
    );
    const edited = await live.until((current) => duneTotals(current).minutes === 75);
    expect(duneTotals(edited)).toEqual({ minutes: 75, pages: 90, sessions: 2 });

    await deleteSession('alice', latest, edited.books.find((book) => book.id === dune.id) as UserBookWithId, edited.sessions, database);
    const deleted = await live.until((current) => duneTotals(current).sessions === 1);
    expect(duneTotals(deleted)).toEqual({ minutes: 30, pages: 50, sessions: 1 });
    // El otro libro no se ve afectado.
    expect(totalsForSessions(sessionsOfBook(deleted.sessions, emma.id))).toEqual({ minutes: 99, pages: 10, sessions: 1 });
    expectBooksMatchSessions(deleted);
  });
});

describe('meta diaria', () => {
  const minutes = (target: number): DailyGoal => ({ type: 'minutes', target });
  const pages = (target: number): DailyGoal => ({ type: 'pages', target });
  /** El progreso de un día, calculado como lo hace la app: con lo leído ese día y la meta de ese momento. */
  const progressOn = (view: LiveView, key: string) =>
    getGoalProgress(view.days.get(key) ?? { minutes: 0, pages: 0 }, view.goal as DailyGoal);

  it('guardar, cambiar y quitar la meta llega a las vistas sin tocar las sesiones', async () => {
    const initial = await live.until((current) => current.goal === undefined);
    expect(initial.goal).toBeUndefined();

    await setDailyGoal('alice', minutes(30), database);
    await live.until((current) => current.goal?.target === 30);
    await setDailyGoal('alice', minutes(45), database);
    await live.until((current) => current.goal?.target === 45);
    await setDailyGoal('alice', undefined, database);
    const removed = await live.until((current) => current.goal === undefined);
    expect(removed.sessions).toEqual([]);
  });

  it('cambiar de minutos a páginas (y volver) llega a las vistas con su tipo', async () => {
    await setDailyGoal('alice', minutes(30), database);
    await live.until((current) => current.goal?.type === 'minutes');
    await setDailyGoal('alice', pages(15), database);
    const toPages = await live.until((current) => current.goal?.type === 'pages');
    expect(toPages.goal).toEqual(pages(15));
    await setDailyGoal('alice', minutes(40), database);
    const back = await live.until((current) => current.goal?.type === 'minutes');
    expect(back.goal).toEqual(minutes(40));
  });

  it('meta de minutos: el progreso de hoy se recalcula solo al registrar, editar y eliminar sesiones', async () => {
    await setDailyGoal('alice', minutes(60), database);
    const book = await addBook();

    await createSession('alice', book, sessionFields(book, { minutes: '30' }), database);
    const half = await live.until((current) => current.goal?.target === 60 && current.sessions.length === 1);
    expect(progressOn(half, TODAY)).toMatchObject({ value: 30, percent: 50, remaining: 30, met: false });

    await createSession('alice', half.books[0], sessionFields(half.books[0], { minutes: '40' }), database);
    const met = await live.until((current) => current.sessions.length === 2);
    expect(progressOn(met, TODAY)).toMatchObject({ percent: 100, remaining: 0, met: true });

    // Editar una de las sesiones para que ya no se llegue a la meta.
    const forty = met.sessions.find((session) => session.durationMinutes === 40) as ReadingSessionWithId;
    await updateSession('alice', forty, sessionFields(met.books[0], { minutes: '10' }), met.books[0], met.sessions, database);
    const edited = await live.until((current) => current.days.get(TODAY)?.minutes === 40);
    expect(progressOn(edited, TODAY)).toMatchObject({ percent: 66, remaining: 20, met: false });

    const thirty = edited.sessions.find((session) => session.durationMinutes === 30) as ReadingSessionWithId;
    await deleteSession('alice', thirty, edited.books[0], edited.sessions, database);
    const deleted = await live.until((current) => current.sessions.length === 1);
    expect(progressOn(deleted, TODAY)).toMatchObject({ value: 10, percent: 16, met: false });
  });

  it('meta de páginas: cuenta las páginas leídas, no los minutos, y se recalcula al registrar, editar y eliminar', async () => {
    await setDailyGoal('alice', pages(20), database);
    const book = await addBook();

    // Muchos minutos y pocas páginas: para una meta de páginas solo cuentan las 8 páginas.
    await createSession('alice', book, sessionFields(book, { minutes: '90', endPage: '8' }), database);
    const first = await live.until((current) => current.goal?.type === 'pages' && current.sessions.length === 1);
    expect(progressOn(first, TODAY)).toMatchObject({ type: 'pages', value: 8, percent: 40, remaining: 12, met: false });

    // La segunda sesión parte de la página en la que iba el libro (8) y llega a la 25: 17 páginas más.
    await createSession('alice', first.books[0], sessionFields(first.books[0], { endPage: '25' }), database);
    const met = await live.until((current) => current.sessions.length === 2);
    expect(progressOn(met, TODAY)).toMatchObject({ value: 25, percent: 100, remaining: 0, met: true });

    // Editarla a la página 15 (7 páginas) la deja por debajo de la meta.
    const second = met.sessions.find((session) => session.endPage === 25) as ReadingSessionWithId;
    await updateSession(
      'alice',
      second,
      sessionFields(met.books[0], { startPage: '8', endPage: '15' }),
      met.books[0],
      met.sessions,
      database,
    );
    const edited = await live.until((current) => current.days.get(TODAY)?.pages === 15);
    expect(progressOn(edited, TODAY)).toMatchObject({ value: 15, percent: 75, remaining: 5, met: false });

    // Eliminar la primera quita sus 8 páginas.
    const firstSession = edited.sessions.find((session) => session.endPage === 8) as ReadingSessionWithId;
    await deleteSession('alice', firstSession, edited.books[0], edited.sessions, database);
    const deleted = await live.until((current) => current.sessions.length === 1);
    expect(progressOn(deleted, TODAY)).toMatchObject({ value: 7, percent: 35, met: false });
  });

  it('con la misma lectura, cambiar el tipo de meta recalcula el progreso sin tocar las sesiones', async () => {
    const book = await addBook();
    await createSession('alice', book, sessionFields(book, { minutes: '30', endPage: '10' }), database);
    await setDailyGoal('alice', minutes(30), database);
    const byMinutes = await live.until((current) => current.goal?.type === 'minutes' && current.sessions.length === 1);
    expect(progressOn(byMinutes, TODAY).met).toBe(true);

    await setDailyGoal('alice', pages(30), database);
    const byPages = await live.until((current) => current.goal?.type === 'pages');
    expect(progressOn(byPages, TODAY)).toMatchObject({ value: 10, percent: 33, met: false });
    expect(byPages.sessions).toHaveLength(1);
  });

  it('el ajuste manual de la página cuenta para la meta de páginas pero no para la de minutos', async () => {
    const book = await addBook();
    await adjustBookProgress('alice', book, 12, new Date(), database);

    await setDailyGoal('alice', pages(12), database);
    const pagesView = await live.until((current) => current.goal?.type === 'pages' && current.sessions.length === 1);
    expect(progressOn(pagesView, TODAY)).toMatchObject({ value: 12, met: true });

    await setDailyGoal('alice', minutes(10), database);
    const minutesView = await live.until((current) => current.goal?.type === 'minutes');
    expect(progressOn(minutesView, TODAY)).toMatchObject({ value: 0, met: false });
  });

  it('la lectura del cronómetro cuenta para la meta, sea de minutos o de páginas', async () => {
    const book = await addBook();
    const draft = buildTimerDraft(pauseTimer(startTimer(book.id, Date.now() - 25 * 60_000), Date.now()), Date.now());
    await createSession('alice', book, sessionFields(book, { minutes: draft.minutes, endPage: '30' }), database, draft.sessionId);

    await setDailyGoal('alice', minutes(25), database);
    const byMinutes = await live.until((current) => current.goal?.type === 'minutes' && current.sessions.length === 1);
    expect(progressOn(byMinutes, TODAY)).toMatchObject({ value: 25, met: true });

    await setDailyGoal('alice', pages(40), database);
    const byPages = await live.until((current) => current.goal?.type === 'pages');
    expect(progressOn(byPages, TODAY)).toMatchObject({ value: 30, percent: 75, remaining: 10, met: false });
  });

  it('cada día se compara con su propia lectura, sin mezclar días', async () => {
    await setDailyGoal('alice', minutes(30), database);
    const book = await addBook();
    const yesterday = addDays(TODAY, -1);
    await createSession('alice', book, sessionFields(book, { minutes: '45', date: dateForDay(yesterday, new Date(), TODAY) }), database);

    const view = await live.until((current) => current.sessions.length === 1 && current.goal?.target === 30);
    expect(progressOn(view, yesterday).met).toBe(true);
    expect(progressOn(view, TODAY)).toMatchObject({ value: 0, met: false, remaining: 30 });
  });

  it('en una meta de páginas, un día pasado se compara con las páginas de ese día', async () => {
    await setDailyGoal('alice', pages(30), database);
    const book = await addBook();
    const yesterday = addDays(TODAY, -1);
    await createSession(
      'alice',
      book,
      sessionFields(book, { startPage: '0', endPage: '35', date: dateForDay(yesterday, new Date(), TODAY) }),
      database,
    );

    const view = await live.until((current) => current.sessions.length === 1 && current.goal?.type === 'pages');
    expect(progressOn(view, yesterday)).toMatchObject({ value: 35, met: true });
    expect(progressOn(view, TODAY)).toMatchObject({ value: 0, met: false, remaining: 30 });
  });
});

describe('registrar desde un día elegido (calendario)', () => {
  it('una lectura de un día pasado conserva esa fecha y no cuenta como hoy', async () => {
    const book = await addBook();
    const pastDay = addDays(TODAY, -5);
    await createSession(
      'alice',
      book,
      sessionFields(book, { minutes: '25', endPage: '40', date: dateForDay(pastDay, new Date(), TODAY) }),
      database,
    );

    const view = await live.until((current) => current.sessions.length === 1 && current.books[0].currentPage === 40);
    expect(view.sessions[0].dateKey).toBe(pastDay);
    expect(view.days.get(pastDay)).toMatchObject({ minutes: 25, pages: 40, isReadingDay: true });
    expect(view.days.has(TODAY)).toBe(false);
    expect(view.streaks).toEqual({ current: 0, longest: 1 });
    expectBooksMatchSessions(view);
  });

  it('una lectura pasada con su página inicial cuenta sus páginas y no mueve el libro', async () => {
    const book = await addBook();
    await createSession('alice', book, sessionFields(book, { minutes: '20', endPage: '100' }), database);
    const advanced = await live.until((current) => current.sessions.length === 1 && current.books[0].currentPage === 100);

    // Hace tres días se leyó de la 20 a la 60, aunque hoy el libro va por la 100.
    const pastDay = addDays(TODAY, -3);
    await createSession(
      'alice',
      advanced.books[0],
      sessionFields(advanced.books[0], { minutes: '30', startPage: '20', endPage: '60', date: dateForDay(pastDay, new Date(), TODAY) }),
      database,
    );

    const view = await live.until((current) => current.sessions.length === 2);
    expect(view.days.get(pastDay)).toMatchObject({ minutes: 30, pages: 40 });
    expect(view.books[0].currentPage).toBe(100);
    expectBooksMatchSessions(view);
  });

  it('una fecha futura se rechaza antes de guardar nada', () => {
    const book = { currentPage: 0, pageCount: 300 };
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const result = parseSessionForm({ date: tomorrow, minutes: '20', startPage: '', endPage: '', notes: '' }, 'b', book);
    expect(result.ok).toBe(false);
  });
});

describe('cronómetro', () => {
  const MINUTE = 60_000;

  it('la lectura medida se guarda con el id del cronómetro y se refleja en todas las vistas', async () => {
    const book = await addBook();
    const timer = pauseTimer(startTimer(book.id, Date.now() - 25 * MINUTE), Date.now());
    const draft = buildTimerDraft(timer, Date.now());

    await createSession('alice', book, sessionFields(book, { minutes: draft.minutes, endPage: '30' }), database, draft.sessionId);

    const view = await live.until((current) => current.sessions.length === 1 && current.books[0].currentPage === 30);
    expect(view.sessions[0].id).toBe(draft.sessionId);
    expect(view.sessions[0].durationMinutes).toBe(25);
    expect(view.days.get(TODAY)).toMatchObject({ minutes: 25, pages: 30 });
  });

  it('guardar dos veces la misma lectura no la duplica ni avanza el libro dos veces', async () => {
    const book = await addBook();
    const draft = buildTimerDraft(pauseTimer(startTimer(book.id, Date.now() - 10 * MINUTE), Date.now()), Date.now());
    await createSession('alice', book, sessionFields(book, { minutes: draft.minutes, endPage: '30' }), database, draft.sessionId);
    const saved = await live.until((current) => current.sessions.length === 1 && current.books[0].currentPage === 30);

    // Un segundo intento (p. ej. una pulsación repetida con la primera aún sin confirmar) lo rechaza Firestore.
    await expect(
      createSession('alice', saved.books[0], sessionFields(saved.books[0], { minutes: '99', endPage: '200' }), database, draft.sessionId),
    ).rejects.toBeDefined();

    // La escritura rechazada se ve un instante en local (Firestore la aplica antes de que el servidor responda) y se
    // revierte al llegar el rechazo: se espera a que la vista converja, que es lo que importa.
    const view = await live.until(
      (current) =>
        current.sessions.length === 1 && current.sessions[0].durationMinutes === 10 && current.books[0].currentPage === 30,
    );
    expect(view.sessions[0].id).toBe(draft.sessionId);
  });

  it('dos cronómetros distintos generan dos sesiones', async () => {
    const book = await addBook();
    const first = buildTimerDraft(pauseTimer(startTimer(book.id, 1_000), 1_000 + 5 * MINUTE), 10 * MINUTE);
    const second = buildTimerDraft(pauseTimer(startTimer(book.id, 2_000), 2_000 + 5 * MINUTE), 10 * MINUTE);
    await createSession('alice', book, sessionFields(book, { minutes: first.minutes }), database, first.sessionId);
    await createSession('alice', book, sessionFields(book, { minutes: second.minutes }), database, second.sessionId);
    const view = await live.until((current) => current.sessions.length === 2);
    expect(new Set(view.sessions.map((session) => session.id)).size).toBe(2);
  });
});
