/**
 * @jest-environment node
 */
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteField, doc, getDoc, serverTimestamp, setDoc, setLogLevel, Timestamp, updateDoc } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';

import type { BookFormValues } from '../../src/types/book';
import {
  EMPTY_BOOK_FORM,
  MAX_AUTHORS,
  MAX_GENRES,
  MAX_PAGE_COUNT,
  MAX_SERIES_NAME_LENGTH,
  MAX_SERIES_ORDER,
  MAX_TITLE_LENGTH,
  READING_STATUSES,
  parseBookForm,
} from '../../src/utils/book';

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

describe('meta diaria en el perfil (minutos o páginas)', () => {
  const profile = () => doc(alice(), 'users/alice');
  beforeEach(async () => {
    await assertSucceeds(setDoc(profile(), validProfile()));
  });

  it('acepta una meta de páginas dentro del rango y rechaza las que se salen', async () => {
    await assertSucceeds(updateDoc(profile(), { dailyGoalPages: 1 }));
    await assertSucceeds(updateDoc(profile(), { dailyGoalPages: 10000 }));
    await assertFails(updateDoc(profile(), { dailyGoalPages: 0 }));
    await assertFails(updateDoc(profile(), { dailyGoalPages: 10001 }));
    await assertFails(updateDoc(profile(), { dailyGoalPages: 12.5 }));
    await assertFails(updateDoc(profile(), { dailyGoalPages: '20' }));
  });

  it('los límites de cada tipo son independientes: 2000 vale en páginas pero no en minutos', async () => {
    await assertSucceeds(updateDoc(profile(), { dailyGoalPages: 2000 }));
    await assertFails(updateDoc(profile(), { dailyGoalMinutes: 2000 }));
  });

  it('la meta es de un solo tipo: no admite minutos y páginas a la vez', async () => {
    await assertFails(updateDoc(profile(), { dailyGoalMinutes: 30, dailyGoalPages: 20 }));
    await assertSucceeds(updateDoc(profile(), { dailyGoalMinutes: 30 }));
    // Para pasar a páginas hay que quitar los minutos en la misma escritura.
    await assertFails(updateDoc(profile(), { dailyGoalPages: 20 }));
    await assertSucceeds(updateDoc(profile(), { dailyGoalPages: 20, dailyGoalMinutes: deleteField() }));
  });

  it('un perfil con la meta antigua en minutos sigue siendo válido', async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users/alice'), { createdAt: Timestamp.now(), timeZone: 'UTC', dailyGoalMinutes: 25 });
    });
    await assertSucceeds(updateDoc(profile(), { nickname: 'Ali' }));
  });
});

describe('objetivo mensual de libros en el perfil', () => {
  const profile = () => doc(alice(), 'users/alice');
  beforeEach(async () => {
    await assertSucceeds(setDoc(profile(), validProfile()));
  });

  it('acepta un número entero de libros entre 1 y 1000 y rechaza el resto', async () => {
    await assertSucceeds(updateDoc(profile(), { monthlyBooksGoal: 1 }));
    await assertSucceeds(updateDoc(profile(), { monthlyBooksGoal: 1000 }));
    await assertFails(updateDoc(profile(), { monthlyBooksGoal: 0 }));
    await assertFails(updateDoc(profile(), { monthlyBooksGoal: 1001 }));
    await assertFails(updateDoc(profile(), { monthlyBooksGoal: 2.5 }));
    await assertFails(updateDoc(profile(), { monthlyBooksGoal: '3' }));
  });

  it('convive con la meta diaria, sea de minutos o de páginas', async () => {
    await assertSucceeds(updateDoc(profile(), { dailyGoalMinutes: 30, monthlyBooksGoal: 4 }));
    await assertSucceeds(updateDoc(profile(), { dailyGoalPages: 20, dailyGoalMinutes: deleteField() }));
    await assertSucceeds(updateDoc(profile(), { monthlyBooksGoal: deleteField() }));
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

describe('libros generados por parseBookForm (el formulario y las reglas deben coincidir)', () => {
  const create = async (values: Partial<BookFormValues>) => {
    const result = parseBookForm({ ...EMPTY_BOOK_FORM, title: 'Dune', authors: 'Frank Herbert', ...values });
    if (!result.ok) throw new Error(`el formulario de prueba no es válido: ${JSON.stringify(result.errors)}`);
    return setDoc(doc(alice(), 'users/alice/books/b1'), {
      ...result.data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  };

  it('acepta un libro con solo título y autor', async () => {
    await assertSucceeds(create({}));
  });

  it('acepta un libro con todos los campos opcionales', async () => {
    await assertSucceeds(
      create({
        pageCount: '662',
        genres: 'Fantasía; Aventura',
        seriesName: 'Crónica del asesino de reyes',
        seriesOrder: '0',
        status: 'finished',
      }),
    );
  });

  it('acepta los límites máximos que permite el formulario', async () => {
    await assertSucceeds(
      create({
        title: 'a'.repeat(MAX_TITLE_LENGTH),
        authors: Array.from({ length: MAX_AUTHORS }, (_, i) => `Autor ${i}`).join(','),
        genres: Array.from({ length: MAX_GENRES }, (_, i) => `Género ${i}`).join(','),
        seriesName: 'a'.repeat(MAX_SERIES_NAME_LENGTH),
        seriesOrder: String(MAX_SERIES_ORDER),
        pageCount: String(MAX_PAGE_COUNT),
      }),
    );
  });

  it('acepta cada estado de lectura', async () => {
    for (const status of READING_STATUSES) {
      await env.clearFirestore();
      await assertSucceeds(create({ status }));
    }
  });
});

describe('lista de deseos y compra (versión 1.1)', () => {
  const ref = () => doc(alice(), 'users/alice/books/b1');
  const wished = () => ({ ...validBook(), status: 'want_to_read', acquisition: 'wishlist' });

  it('permite crear un deseo y comprarlo: pasa a propio con fecha y precio en el mismo documento', async () => {
    await assertSucceeds(setDoc(ref(), wished()));
    await assertSucceeds(
      updateDoc(ref(), { acquisition: 'owned', purchasedAt: Timestamp.now(), price: 45000, updatedAt: serverTimestamp() }),
    );
  });

  it('un libro propio puede llevar precio y fecha de compra; el precio puede ser 0 o decimal', async () => {
    await assertSucceeds(setDoc(ref(), { ...validBook(), price: 0, purchasedAt: Timestamp.now() }));
    await assertSucceeds(updateDoc(ref(), { price: 45.5, updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(ref(), { price: 999999999, updatedAt: serverTimestamp() }));
  });

  it('rechaza precios negativos, fuera de rango o que no son números, y fechas que no son fechas', async () => {
    await assertFails(setDoc(ref(), { ...validBook(), price: -1 }));
    await assertFails(setDoc(ref(), { ...validBook(), price: 1000000000 }));
    await assertFails(setDoc(ref(), { ...validBook(), price: '45' }));
    await assertFails(setDoc(ref(), { ...validBook(), purchasedAt: '2026-10-15' }));
  });

  it('un deseo no puede llevar datos de compra: aún no se ha comprado', async () => {
    await assertFails(setDoc(ref(), { ...wished(), price: 100 }));
    await assertFails(setDoc(ref(), { ...wished(), purchasedAt: Timestamp.now() }));
    await assertSucceeds(setDoc(ref(), wished()));
    await assertFails(updateDoc(ref(), { price: 100, updatedAt: serverTimestamp() }));
  });

  it('se puede quitar el precio de un libro comprado sin tocar el resto', async () => {
    await assertSucceeds(setDoc(ref(), { ...validBook(), price: 10, purchasedAt: Timestamp.now() }));
    await assertSucceeds(updateDoc(ref(), { price: deleteField(), updatedAt: serverTimestamp() }));
  });

  it('otro usuario no puede comprar ni leer los deseos ajenos', async () => {
    await assertSucceeds(setDoc(ref(), wished()));
    await assertFails(updateDoc(doc(bob(), 'users/alice/books/b1'), { acquisition: 'owned', updatedAt: serverTimestamp() }));
    await assertFails(getDoc(doc(bob(), 'users/alice/books/b1')));
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
