/**
 * @jest-environment node
 */
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  setLogLevel,
  updateDoc,
  type Firestore,
} from 'firebase/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';

// Reglas de la migración a la API: la app solo LEE de Firestore; escribe la API con el Admin SDK, que no pasa por las reglas.
// Requiere el emulador de Firestore: npm run test:rules
setLogLevel('silent');

let env: RulesTestEnvironment;
const alice = () => env.authenticatedContext('alice').firestore() as unknown as Firestore;
const bob = () => env.authenticatedContext('bob').firestore() as unknown as Firestore;
const anonymous = () => env.unauthenticatedContext().firestore() as unknown as Firestore;

const PROFILE = { createdAt: serverTimestamp(), timeZone: 'UTC', displayName: 'Alice' };

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-lectoria',
    firestore: { rules: readFileSync(join(__dirname, '../../firestore.api.rules'), 'utf8') },
  });
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
  // Datos de Alice sembrados como lo haría la API (sin pasar por las reglas).
  await env.withSecurityRulesDisabled(async (context) => {
    const database = context.firestore() as unknown as Firestore;
    await setDoc(doc(database, 'users', 'alice'), PROFILE);
    await setDoc(doc(database, 'users', 'alice', 'books', 'b1'), { title: 'Dune', authors: ['F'], status: 'reading', acquisition: 'owned', currentPage: 0 });
    await setDoc(doc(database, 'users', 'alice', 'sessions', 's1'), { bookId: 'b1', dateKey: '2026-10-13', pagesRead: 0, durationMinutes: 10 });
    await setDoc(doc(database, 'users', 'alice', 'collections', 'c1'), { name: 'Favoritos', kind: 'manual', bookIds: [] });
    await setDoc(doc(database, 'users', 'alice', 'reminders', 'r1'), { hour: 20 });
  });
});

const PATHS = [
  ['users', 'alice'],
  ['users', 'alice', 'books', 'b1'],
  ['users', 'alice', 'sessions', 's1'],
  ['users', 'alice', 'collections', 'c1'],
  // Una subcolección que se añada en el futuro queda cubierta sin tocar las reglas.
  ['users', 'alice', 'reminders', 'r1'],
] as const;

describe('lectura', () => {
  it.each(PATHS)('el dueño lee %s/%s/%s/%s', async (...segments) => {
    await assertSucceeds(getDoc(doc(alice(), segments.join('/'))));
  });

  it('el dueño lista sus libros, sesiones y colecciones', async () => {
    for (const name of ['books', 'sessions', 'collections']) {
      const snapshot = await assertSucceeds(getDocs(collection(alice(), 'users', 'alice', name)));
      expect(snapshot.size).toBe(1);
    }
  });

  it.each(PATHS)('otra persona no lee %s/%s/%s/%s', async (...segments) => {
    await assertFails(getDoc(doc(bob(), segments.join('/'))));
  });

  it('otra persona no puede listar la biblioteca ajena', async () => {
    await assertFails(getDocs(collection(bob(), 'users', 'alice', 'books')));
  });

  it.each(PATHS)('sin sesión no se lee %s/%s/%s/%s', async (...segments) => {
    await assertFails(getDoc(doc(anonymous(), segments.join('/'))));
  });
});

describe('escritura: nadie escribe desde la app, tampoco el dueño', () => {
  it('no se puede crear nada', async () => {
    await assertFails(setDoc(doc(alice(), 'users', 'alice', 'books', 'nuevo'), { title: 'x', authors: ['y'] }));
    await assertFails(addDoc(collection(alice(), 'users', 'alice', 'sessions'), { bookId: 'b1', dateKey: '2026-10-13', pagesRead: 1, durationMinutes: 0 }));
    await assertFails(addDoc(collection(alice(), 'users', 'alice', 'collections'), { name: 'x', kind: 'manual' }));
    await assertFails(setDoc(doc(alice(), 'users', 'alice', 'reminders', 'nuevo'), { hour: 8 }));
  });

  it('no se puede cambiar nada, ni siquiera con datos válidos', async () => {
    await assertFails(updateDoc(doc(alice(), 'users', 'alice', 'books', 'b1'), { currentPage: 99 }));
    await assertFails(updateDoc(doc(alice(), 'users', 'alice', 'sessions', 's1'), { durationMinutes: 99 }));
    await assertFails(updateDoc(doc(alice(), 'users', 'alice', 'collections', 'c1'), { name: 'Otro' }));
    await assertFails(updateDoc(doc(alice(), 'users', 'alice'), { dailyGoalMinutes: 30 }));
    await assertFails(setDoc(doc(alice(), 'users', 'alice'), { ...PROFILE, monthlyBooksGoal: 4 }));
  });

  it('no se puede borrar nada', async () => {
    await assertFails(deleteDoc(doc(alice(), 'users', 'alice', 'books', 'b1')));
    await assertFails(deleteDoc(doc(alice(), 'users', 'alice', 'sessions', 's1')));
    await assertFails(deleteDoc(doc(alice(), 'users', 'alice', 'collections', 'c1')));
    await assertFails(deleteDoc(doc(alice(), 'users', 'alice')));
  });

  it('otra persona ni sin sesión escribe en la biblioteca de Alice', async () => {
    await assertFails(setDoc(doc(bob(), 'users', 'alice', 'books', 'b2'), { title: 'x' }));
    await assertFails(updateDoc(doc(bob(), 'users', 'alice', 'books', 'b1'), { currentPage: 1 }));
    await assertFails(deleteDoc(doc(bob(), 'users', 'alice', 'books', 'b1')));
    await assertFails(setDoc(doc(anonymous(), 'users', 'alice', 'books', 'b2'), { title: 'x' }));
  });

  it('lo que no está bajo users/{uid} no se lee ni se escribe', async () => {
    await assertFails(getDoc(doc(alice(), 'catalogo', 'x')));
    await assertFails(setDoc(doc(alice(), 'catalogo', 'x'), { a: 1 }));
  });
});
