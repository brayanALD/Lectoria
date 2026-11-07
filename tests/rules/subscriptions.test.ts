/**
 * @jest-environment node
 */
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, serverTimestamp, setDoc, setLogLevel, Timestamp, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';

import * as booksApi from '../../src/services/booksService';
import { subscribeToBooks } from '../../src/services/booksService';
import * as collectionsApi from '../../src/services/collectionsService';
import { subscribeToCollections } from '../../src/services/collectionsService';
import * as sessionsApi from '../../src/services/sessionsService';
import { subscribeToSessions } from '../../src/services/sessionsService';
import * as userApi from '../../src/services/userService';
import { subscribeToDailyGoal, subscribeToMonthlyBooksGoal } from '../../src/services/userService';
import type { User } from '../../src/services/authService';
import type { UserBookWithId } from '../../src/types/book';
import type { CollectionWithId } from '../../src/types/collection';
import type { DailyGoal } from '../../src/types/goal';
import type { ReadingSessionWithId } from '../../src/types/session';
import { toDateKey } from '../../src/utils/session';
import { actAs, startApi, stopApi } from './apiHarness';

// Los servicios importan db de firebaseConfig (React Native); en las pruebas se les pasa el Firestore del emulador.
jest.mock('../../firebaseConfig', () => ({ db: {}, auth: {} }));
// Las ESCRITURAS de la app van por la API (aquí, la real, en este mismo proceso); las LECTURAS son las suscripciones de
// Firestore bajo las reglas de solo lectura. Requiere el emulador de Firestore: npm run test:rules
jest.mock('../../src/services/apiClient', () => require('./apiHarness'));
setLogLevel('silent');

let env: RulesTestEnvironment;
const alice = () => env.authenticatedContext('alice').firestore() as unknown as Firestore;
const bob = () => env.authenticatedContext('bob').firestore() as unknown as Firestore;

beforeAll(async () => {
  await startApi();
  env = await initializeTestEnvironment({
    projectId: 'demo-lectoria',
    firestore: { rules: readFileSync(join(__dirname, '../../firestore.api.rules'), 'utf8') },
  });
});
afterAll(async () => {
  await env.cleanup();
  await stopApi();
});
beforeEach(async () => {
  await env.clearFirestore();
  // El perfil lo crea la app al iniciar sesión (`ensureUserProfile`).
  for (const uid of ['alice', 'bob']) {
    actAs(uid);
    await userApi.ensureUserProfile({ uid, displayName: uid, email: null } as User);
  }
  actAs('alice');
});

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** La primera lista que cumple la condición de una suscripción (o su error). */
function firstMatching<T>(
  subscribe: (onItems: (items: T) => void, onError: (error: Error) => void) => () => void,
  until: (items: T) => boolean = () => true,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const stop = subscribe((items) => {
      if (until(items)) {
        stop();
        resolve(items);
      }
    }, reject);
  });
}

const TZ = 'UTC';

describe('subscribeToBooks', () => {
  const books = (database: Firestore, uid = 'alice', until?: (list: UserBookWithId[]) => boolean) =>
    firstMatching<UserBookWithId[]>((ok, fail) => subscribeToBooks(uid, ok, fail, database), until);

  it('devuelve una lista vacía cuando no hay libros', async () => {
    expect(await books(alice())).toEqual([]);
  });

  it('devuelve los libros con su id y ordenados del más reciente al más antiguo', async () => {
    const first = await booksApi.createBook({ title: 'Primero', authors: ['A'], status: 'want_to_read', acquisition: 'owned', currentPage: 0 });
    await pause(50);
    const second = await booksApi.createBook({ title: 'Segundo', authors: ['A'], status: 'want_to_read', acquisition: 'owned', currentPage: 0 });

    const list = await books(alice(), 'alice', (items) => items.length === 2);
    expect(list.map((book) => book.id)).toEqual([second, first]);
    expect(list[0].createdAt).toBeInstanceOf(Timestamp);
  });

  it('un usuario no puede leer la biblioteca de otro', async () => {
    await booksApi.createBook({ title: 'Mío', authors: ['A'], status: 'want_to_read', acquisition: 'owned', currentPage: 0 });
    await expect(books(bob(), 'alice')).rejects.toBeDefined();
  });
});

describe('subscribeToSessions', () => {
  const sessions = (database: Firestore, uid = 'alice', until?: (list: ReadingSessionWithId[]) => boolean) =>
    firstMatching<ReadingSessionWithId[]>((ok, fail) => subscribeToSessions(uid, ok, fail, database), until);

  it('devuelve una lista vacía si no hay sesiones', async () => {
    expect(await sessions(alice())).toEqual([]);
  });

  it('devuelve las sesiones con su id, de la más reciente a la más antigua', async () => {
    const book = await booksApi.createBook({ title: 'Dune', authors: ['A'], status: 'reading', acquisition: 'owned', currentPage: 0 });
    const day = (offset: number) => new Date(Date.now() + offset);
    const make = (date: Date) => ({ bookId: book, date, dateKey: toDateKey(date, TZ), pagesRead: 0, durationMinutes: 10 });
    const older = await sessionsApi.createSession(make(day(-2 * 60 * 60 * 1000)));
    const newer = await sessionsApi.createSession(make(day(0)));

    const list = await sessions(alice(), 'alice', (items) => items.length === 2);
    expect(list.map((session) => session.id)).toEqual([newer, older]);
    expect(list[0].createdAt).toBeInstanceOf(Timestamp);
  });

  it('un usuario no puede leer las sesiones de otro', async () => {
    await expect(sessions(bob(), 'alice')).rejects.toBeDefined();
  });
});

describe('subscribeToCollections', () => {
  const collections = (database: Firestore, uid = 'alice', until?: (list: CollectionWithId[]) => boolean) =>
    firstMatching<CollectionWithId[]>((ok, fail) => subscribeToCollections(uid, ok, fail, database), until);

  it('entrega las colecciones con su id, de la más antigua a la más reciente', async () => {
    const first = await collectionsApi.createManualCollection('Primera', []);
    await pause(20);
    const second = await collectionsApi.createFilterCollection('Segunda', { acquisition: 'owned', genre: 'x' });
    const items = await collections(alice(), 'alice', (list) => list.length === 2);
    expect(items.map((item) => item.id)).toEqual([first, second]);
    expect(items.map((item) => item.kind)).toEqual(['manual', 'filter']);
  });

  it('solo entrega las del usuario, y no se pueden leer las de otro', async () => {
    await collectionsApi.createManualCollection('De Alice', []);
    actAs('bob');
    await collectionsApi.createManualCollection('De Bob', []);
    actAs('alice');
    const items = await collections(alice(), 'alice', (list) => list.length === 1);
    expect(items.map((item) => item.name)).toEqual(['De Alice']);
    await expect(collections(bob(), 'alice')).rejects.toBeDefined();
  });
});

const minutes = (target: number): DailyGoal => ({ type: 'minutes', target });
const pages = (target: number): DailyGoal => ({ type: 'pages', target });

describe('subscribeToDailyGoal', () => {
  const goal = (database: Firestore, uid = 'alice', until: (goal: DailyGoal | undefined) => boolean = () => true) =>
    firstMatching<DailyGoal | undefined>((ok, fail) => subscribeToDailyGoal(uid, ok, fail, database), until);

  it('sin meta devuelve undefined', async () => {
    expect(await goal(alice())).toBeUndefined();
  });

  it('devuelve la meta con su tipo', async () => {
    await userApi.setDailyGoal(minutes(25));
    expect(await goal(alice())).toEqual(minutes(25));
    await userApi.setDailyGoal(pages(12));
    expect(await goal(alice())).toEqual(pages(12));
  });

  it('una meta antigua, que solo tiene `dailyGoalMinutes`, se lee como de minutos sin migrar nada', async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users', 'alice'), { createdAt: serverTimestamp(), timeZone: 'UTC', dailyGoalMinutes: 35 });
    });
    expect(await goal(alice())).toEqual(minutes(35));
  });

  it('se entera de los cambios, también al cambiar de tipo, y de que se quita', async () => {
    const toPages = goal(alice(), 'alice', (value) => value?.type === 'pages');
    await userApi.setDailyGoal(minutes(50));
    await userApi.setDailyGoal(pages(8));
    expect(await toPages).toEqual(pages(8));

    const removed = goal(alice(), 'alice', (value) => value === undefined);
    await userApi.setDailyGoal(undefined);
    expect(await removed).toBeUndefined();
  });

  it('un usuario no puede leer la meta de otro', async () => {
    await expect(goal(bob(), 'alice')).rejects.toBeDefined();
  });
});

describe('subscribeToMonthlyBooksGoal', () => {
  const target = (database: Firestore, uid = 'alice', until: (value: number | undefined) => boolean = () => true) =>
    firstMatching<number | undefined>((ok, fail) => subscribeToMonthlyBooksGoal(uid, ok, fail, database), until);

  it('sin objetivo devuelve undefined', async () => {
    expect(await target(alice())).toBeUndefined();
  });

  it('devuelve el objetivo y se entera de los cambios y de que se quita', async () => {
    await userApi.setMonthlyBooksGoal(3);
    expect(await target(alice())).toBe(3);
    const changed = target(alice(), 'alice', (value) => value === 5);
    await userApi.setMonthlyBooksGoal(5);
    expect(await changed).toBe(5);
    const removed = target(alice(), 'alice', (value) => value === undefined);
    await userApi.setMonthlyBooksGoal(undefined);
    expect(await removed).toBeUndefined();
  });

  it('es independiente de la meta diaria: ninguna borra a la otra', async () => {
    await userApi.setDailyGoal(minutes(30));
    await userApi.setMonthlyBooksGoal(2);
    await userApi.setDailyGoal(undefined);
    expect(await target(alice())).toBe(2);
    await userApi.setDailyGoal(pages(10));
    await userApi.setMonthlyBooksGoal(undefined);
    const goalNow = await firstMatching<DailyGoal | undefined>((ok, fail) => subscribeToDailyGoal('alice', ok, fail, alice()));
    expect(goalNow).toEqual(pages(10));
  });

  it('un usuario no puede leer el objetivo de otro', async () => {
    await expect(target(bob(), 'alice')).rejects.toBeDefined();
  });
});
