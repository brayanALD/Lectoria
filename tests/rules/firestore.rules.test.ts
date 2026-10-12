/**
 * @jest-environment node
 */
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, serverTimestamp, setDoc, setLogLevel, Timestamp, updateDoc } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';

// Requiere el emulador de Firestore: npm run test:rules
// Las pruebas de rechazo generan PERMISSION_DENIED esperados; se silencia el log del SDK.
setLogLevel('silent');

let env: RulesTestEnvironment;

const alice = () => env.authenticatedContext('alice').firestore();
const bob = () => env.authenticatedContext('bob').firestore();
const anonymous = () => env.unauthenticatedContext().firestore();

const validProfile = () => ({ createdAt: serverTimestamp(), timeZone: 'America/Bogota', displayName: 'Ana' });

const validBook = () => ({
  title: 'Dune',
  authors: ['Frank Herbert'],
  status: 'reading',
  acquisition: 'owned',
  currentPage: 0,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});

const validSession = () => ({
  bookId: 'book1',
  date: Timestamp.now(),
  dateKey: '2026-10-12',
  pagesRead: 20,
  durationMinutes: 30,
  createdAt: serverTimestamp(),
});

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

describe('aislamiento entre usuarios', () => {
  it('un usuario no autenticado no puede leer ni escribir', async () => {
    await assertFails(getDoc(doc(anonymous(), 'users/alice')));
    await assertFails(setDoc(doc(anonymous(), 'users/alice'), validProfile()));
  });

  it('un usuario no puede leer ni escribir los datos de otro', async () => {
    await assertSucceeds(setDoc(doc(alice(), 'users/alice/books/b1'), validBook()));
    await assertFails(getDoc(doc(bob(), 'users/alice/books/b1')));
    await assertFails(setDoc(doc(bob(), 'users/alice/books/b2'), validBook()));
    await assertFails(setDoc(doc(bob(), 'users/alice/sessions/s1'), validSession()));
    await assertFails(getDoc(doc(bob(), 'users/alice')));
  });

  it('deniega rutas no declaradas, incluso al propietario', async () => {
    await assertFails(getDoc(doc(alice(), 'catalogBooks/9780441013593')));
    await assertFails(setDoc(doc(alice(), 'users/alice/otraColeccion/x'), { a: 1 }));
  });
});

describe('perfil users/{uid}', () => {
  it('permite crear un perfil válido', async () => {
    await assertSucceeds(setDoc(doc(alice(), 'users/alice'), validProfile()));
  });

  it('acepta apodo opcional y exige nombre al crear', async () => {
    await assertSucceeds(setDoc(doc(alice(), 'users/alice'), { ...validProfile(), nickname: 'Lectora' }));
    const { displayName: _omitted, ...withoutName } = validProfile();
    await assertFails(setDoc(doc(bob(), 'users/bob'), withoutName));
  });

  it('rechaza nombre o apodo vacíos o demasiado largos', async () => {
    const ref = doc(alice(), 'users/alice');
    await assertFails(setDoc(ref, { ...validProfile(), displayName: '' }));
    await assertFails(setDoc(ref, { ...validProfile(), displayName: 'a'.repeat(61) }));
    await assertFails(setDoc(ref, { ...validProfile(), nickname: '' }));
    await assertFails(setDoc(ref, { ...validProfile(), nickname: 'a'.repeat(31) }));
  });

  it('permite actualizar un perfil anterior que no tiene nombre', async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users/alice'), { createdAt: Timestamp.now(), timeZone: 'UTC' });
    });
    await assertSucceeds(updateDoc(doc(alice(), 'users/alice'), { dailyGoalMinutes: 20 }));
  });

  it('rechaza campos desconocidos y createdAt fijado por el cliente', async () => {
    await assertFails(setDoc(doc(alice(), 'users/alice'), { ...validProfile(), isAdmin: true }));
    await assertFails(setDoc(doc(alice(), 'users/alice'), { ...validProfile(), createdAt: Timestamp.now() }));
  });

  it('rechaza objetivos fuera de rango y no permite cambiar createdAt', async () => {
    await assertSucceeds(setDoc(doc(alice(), 'users/alice'), validProfile()));
    await assertSucceeds(updateDoc(doc(alice(), 'users/alice'), { dailyGoalMinutes: 30 }));
    await assertFails(updateDoc(doc(alice(), 'users/alice'), { dailyGoalMinutes: 0 }));
    await assertFails(updateDoc(doc(alice(), 'users/alice'), { createdAt: Timestamp.now() }));
  });
});

describe('libros users/{uid}/books', () => {
  it('permite crear y editar un libro válido', async () => {
    const ref = doc(alice(), 'users/alice/books/b1');
    await assertSucceeds(setDoc(ref, validBook()));
    await assertSucceeds(updateDoc(ref, { currentPage: 50, rating: 5, updatedAt: serverTimestamp() }));
  });

  it('rechaza estados, valoraciones y títulos inválidos', async () => {
    const ref = doc(alice(), 'users/alice/books/b1');
    await assertFails(setDoc(ref, { ...validBook(), status: 'leyendo' }));
    await assertFails(setDoc(ref, { ...validBook(), acquisition: 'prestado' }));
    await assertFails(setDoc(ref, { ...validBook(), rating: 6 }));
    await assertFails(setDoc(ref, { ...validBook(), rating: 0 }));
    await assertFails(setDoc(ref, { ...validBook(), title: '' }));
    await assertFails(setDoc(ref, { ...validBook(), currentPage: -1 }));
  });

  it('rechaza campos desconocidos y fechas de control fijadas por el cliente', async () => {
    const ref = doc(alice(), 'users/alice/books/b1');
    await assertFails(setDoc(ref, { ...validBook(), isPurchased: true }));
    await assertFails(setDoc(ref, { ...validBook(), updatedAt: Timestamp.now() }));
  });

  it('no permite modificar createdAt ni quitar campos obligatorios al editar', async () => {
    const ref = doc(alice(), 'users/alice/books/b1');
    await assertSucceeds(setDoc(ref, validBook()));
    await assertFails(updateDoc(ref, { createdAt: Timestamp.now(), updatedAt: serverTimestamp() }));
    await assertFails(setDoc(ref, { title: 'Solo título', updatedAt: serverTimestamp() }));
  });
});

describe('sesiones users/{uid}/sessions', () => {
  it('permite crear una sesión válida, con o sin páginas inicial y final', async () => {
    await assertSucceeds(setDoc(doc(alice(), 'users/alice/sessions/s1'), validSession()));
    await assertSucceeds(
      setDoc(doc(alice(), 'users/alice/sessions/s2'), { ...validSession(), startPage: 10, endPage: 30 }),
    );
  });

  it('rechaza sesiones vacías, rangos de páginas invertidos y dateKey mal formado', async () => {
    const ref = doc(alice(), 'users/alice/sessions/s1');
    await assertFails(setDoc(ref, { ...validSession(), pagesRead: 0, durationMinutes: 0 }));
    await assertFails(setDoc(ref, { ...validSession(), startPage: 30, endPage: 10 }));
    await assertFails(setDoc(ref, { ...validSession(), dateKey: '12/10/2026' }));
    await assertFails(setDoc(ref, { ...validSession(), durationMinutes: 1441 }));
    await assertFails(setDoc(ref, { ...validSession(), pagesRead: -5 }));
  });

  it('rechaza campos desconocidos', async () => {
    await assertFails(setDoc(doc(alice(), 'users/alice/sessions/s1'), { ...validSession(), unlockedAchievement: true }));
  });
});
