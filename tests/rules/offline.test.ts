/**
 * @jest-environment node
 */
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import {
  deleteDoc,
  disableNetwork,
  doc,
  enableNetwork,
  setDoc,
  setLogLevel,
  Timestamp,
  type Firestore,
} from 'firebase/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';

import { createBook, subscribeToBooks } from '../../src/services/booksService';
import { subscribeToSessions } from '../../src/services/sessionsService';
import { EMPTY_BOOK_FORM, parseBookForm } from '../../src/utils/book';
import { getFirestoreErrorMessage } from '../../src/utils/firestoreErrors';

// Los servicios importan db de firebaseConfig (React Native); en las pruebas se les pasa el Firestore del emulador.
jest.mock('../../firebaseConfig', () => ({ db: {}, auth: {} }));

// Requiere el emulador de Firestore: npm run test:rules
// Simula «sin conexión» con disableNetwork: es lo que ve la app cuando el teléfono no tiene red.
setLogLevel('silent');

let env: RulesTestEnvironment;
const newAlice = () => env.authenticatedContext('alice').firestore() as unknown as Firestore;

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

/** Siembra, sin reglas, `count` libros y `count` lecturas de alice. */
async function seed(count: number): Promise<void> {
  await env.withSecurityRulesDisabled(async (context) => {
    const database = context.firestore() as unknown as Firestore;
    for (let i = 0; i < count; i++) {
      await setDoc(doc(database, 'users', 'alice', 'books', `book-${i}`), {
        title: `Libro ${i}`,
        createdAt: Timestamp.fromMillis(1_700_000_000_000 + i),
      });
      await setDoc(doc(database, 'users', 'alice', 'sessions', `session-${i}`), {
        bookId: `book-${i}`,
        date: Timestamp.fromMillis(1_700_000_000_000 + i),
      });
    }
  });
}

type Event = { kind: 'items'; ids: string[] } | { kind: 'error'; code: string; message: string };

/** Se suscribe y guarda lo que va recibiendo la pantalla: listas o errores, en orden. */
function listen(kind: 'books' | 'sessions', database: Firestore) {
  const events: Event[] = [];
  const onItems = (items: { id: string }[]) => events.push({ kind: 'items', ids: items.map((item) => item.id).sort() });
  const onError = (error: Error) =>
    events.push({
      kind: 'error',
      code: String((error as { code?: unknown }).code),
      message: getFirestoreErrorMessage(error),
    });
  const stop =
    kind === 'books'
      ? subscribeToBooks('alice', onItems, onError, database)
      : subscribeToSessions('alice', onItems, onError, database);
  return { events, stop };
}

async function waitFor(condition: () => boolean, ms = 8000): Promise<void> {
  const limit = Date.now() + ms;
  while (!condition()) {
    if (Date.now() > limit) throw new Error('se agotó la espera');
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

const last = (events: Event[]) => events[events.length - 1];

describe.each(['books', 'sessions'] as const)('sin conexión: %s', (kind) => {
  const name = kind === 'books' ? 'Libro' : 'Lectura';
  const prefix = kind === 'books' ? 'book' : 'session';

  it('con la app recién abierta y sin red, no se hace pasar por una lista vacía: avisa de que no hay conexión', async () => {
    await seed(2);
    const database = newAlice();
    await disableNetwork(database);

    const { events, stop } = listen(kind, database);
    await waitFor(() => events.length > 0);
    stop();

    expect(events.some((event) => event.kind === 'items')).toBe(false);
    expect(events[0]).toMatchObject({ kind: 'error', code: 'unavailable', message: expect.stringMatching(/Sin conexión/) });
  });

  it('al volver la red entrega lo que hay y deja de avisar', async () => {
    await seed(2);
    const database = newAlice();
    await disableNetwork(database);

    const { events, stop } = listen(kind, database);
    await waitFor(() => events.length > 0);
    await enableNetwork(database);
    await waitFor(() => last(events).kind === 'items');
    stop();

    expect(last(events)).toEqual({ kind: 'items', ids: [`${prefix}-0`, `${prefix}-1`] });
  });

  it('lo que ya se cargó en la sesión se sigue viendo al perder la red', async () => {
    await seed(2);
    const database = newAlice();
    const online = listen(kind, database);
    await waitFor(() => online.events.some((event) => event.kind === 'items' && event.ids.length === 2));

    await disableNetwork(database);
    const offline = listen(kind, database);
    await waitFor(() => offline.events.length > 0);
    online.stop();
    offline.stop();

    expect(offline.events[0]).toEqual({ kind: 'items', ids: [`${prefix}-0`, `${prefix}-1`] });
    expect(offline.events.some((event) => event.kind === 'error')).toBe(false);
  });

  it(`con red y sin ${name.toLowerCase()}s es una lista vacía de verdad, no un aviso de conexión`, async () => {
    const database = newAlice();
    const { events, stop } = listen(kind, database);
    await waitFor(() => events.length > 0);
    stop();

    expect(events[0]).toEqual({ kind: 'items', ids: [] });
    expect(events.some((event) => event.kind === 'error')).toBe(false);
  });
});

describe('sin conexión: guardar', () => {
  it('eliminar el último libro sin red deja la lista vacía, sin avisar de falta de conexión', async () => {
    await seed(1);
    const database = newAlice();
    const { events, stop } = listen('books', database);
    await waitFor(() => events.some((event) => event.kind === 'items' && event.ids.length === 1));

    await disableNetwork(database);
    // Sin red la eliminación no termina hasta recuperarla; la lista se actualiza al momento.
    const deleted = deleteDoc(doc(database, 'users', 'alice', 'books', 'book-0'));
    await waitFor(() => last(events).kind === 'items' && (last(events) as { ids: string[] }).ids.length === 0);
    expect(events.some((event) => event.kind === 'error')).toBe(false);

    await enableNetwork(database);
    await deleted;
    stop();
  });

  it('un libro creado sin red aparece enseguida y se confirma al volver la red', async () => {
    const database = newAlice();
    const { events, stop } = listen('books', database);
    await waitFor(() => events.length > 0);
    await disableNetwork(database);

    const parsed = parseBookForm({ ...EMPTY_BOOK_FORM, title: 'Dune', authors: 'Frank Herbert' });
    if (!parsed.ok) throw new Error('formulario inválido');
    // Sin red la escritura no termina hasta recuperarla (por eso la app corta la espera con un tiempo máximo).
    const saved = createBook('alice', parsed.data, database);
    let finished = false;
    void saved.then(() => (finished = true));

    await waitFor(() => events.some((event) => event.kind === 'items' && event.ids.length === 1));
    expect(finished).toBe(false);

    await enableNetwork(database);
    await saved;
    expect(finished).toBe(true);
    stop();
  });
});
