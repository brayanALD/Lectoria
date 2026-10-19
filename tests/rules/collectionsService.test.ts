/**
 * @jest-environment node
 */
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { addDoc, collection, doc, getDoc, getDocs, serverTimestamp, setDoc, setLogLevel, updateDoc, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';

import {
  createFilterCollection,
  createManualCollection,
  deleteCollection,
  subscribeToCollections,
  updateCollection,
} from '../../src/services/collectionsService';
import type { CollectionWithId } from '../../src/types/collection';
import { MAX_COLLECTION_BOOKS } from '../../src/utils/collections';

// El servicio importa db de firebaseConfig (React Native); en las pruebas se le pasa el Firestore del emulador.
jest.mock('../../firebaseConfig', () => ({ db: {}, auth: {} }));

// Requiere el emulador de Firestore: npm run test:rules
setLogLevel('silent');

let env: RulesTestEnvironment;
const alice = () => env.authenticatedContext('alice').firestore() as unknown as Firestore;
const bob = () => env.authenticatedContext('bob').firestore() as unknown as Firestore;
const anonymous = () => env.unauthenticatedContext().firestore() as unknown as Firestore;

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

const collectionsOf = (database: Firestore, uid = 'alice') => collection(database, 'users', uid, 'collections');
const docOf = (database: Firestore, id: string, uid = 'alice') => doc(database, 'users', uid, 'collections', id);

/** Un documento de colección escrito a mano, para probar lo que las reglas aceptan o rechazan. */
const manual = (extra: Record<string, unknown> = {}) => ({
  name: 'Para regalar',
  kind: 'manual',
  bookIds: ['a', 'b'],
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  ...extra,
});
const filter = (extra: Record<string, unknown> = {}) => ({
  name: 'Fantasía sin leer',
  kind: 'filter',
  filters: { acquisition: 'owned', genre: 'Fantasía' },
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  ...extra,
});

describe('crear colecciones con el servicio', () => {
  it('crea una colección manual con sus libros', async () => {
    const id = await createManualCollection('alice', 'Para regalar', ['a', 'b'], alice());
    const data = (await getDoc(docOf(alice(), id))).data()!;
    expect(data).toMatchObject({ name: 'Para regalar', kind: 'manual', bookIds: ['a', 'b'] });
    expect(data.createdAt).toBeDefined();
    expect('filters' in data).toBe(false);
  });

  it('crea una colección manual vacía', async () => {
    const id = await createManualCollection('alice', 'Vacía', [], alice());
    expect((await getDoc(docOf(alice(), id))).data()!.bookIds).toEqual([]);
  });

  it('crea una estantería filtrada con sus filtros', async () => {
    const filters = { acquisition: 'wishlist', genre: 'Fantasía', series: 'Dune', query: 'dune' } as const;
    const id = await createFilterCollection('alice', 'Deseos de fantasía', filters, alice());
    const data = (await getDoc(docOf(alice(), id))).data()!;
    expect(data).toMatchObject({ kind: 'filter', filters });
    expect('bookIds' in data).toBe(false);
  });

  it('renombra sin tocar el resto', async () => {
    const id = await createManualCollection('alice', 'Viejo', ['a'], alice());
    await updateCollection('alice', id, { name: 'Nuevo' }, alice());
    expect((await getDoc(docOf(alice(), id))).data()).toMatchObject({ name: 'Nuevo', kind: 'manual', bookIds: ['a'] });
  });

  it('reemplaza los libros de una colección manual', async () => {
    const id = await createManualCollection('alice', 'Lista', ['a'], alice());
    await updateCollection('alice', id, { bookIds: ['b', 'c'] }, alice());
    expect((await getDoc(docOf(alice(), id))).data()!.bookIds).toEqual(['b', 'c']);
  });

  it('cambia el nombre y los libros a la vez, en una sola escritura', async () => {
    const id = await createManualCollection('alice', 'Lista', ['a'], alice());
    await updateCollection('alice', id, { name: 'Lista nueva', bookIds: ['c'] }, alice());
    expect((await getDoc(docOf(alice(), id))).data()).toMatchObject({ name: 'Lista nueva', bookIds: ['c'] });
  });

  it('renombrar una estantería no le pone libros', async () => {
    const id = await createFilterCollection('alice', 'Vieja', { acquisition: 'owned', genre: 'x' }, alice());
    await updateCollection('alice', id, { name: 'Nueva' }, alice());
    const data = (await getDoc(docOf(alice(), id))).data()!;
    expect(data).toMatchObject({ name: 'Nueva', kind: 'filter', filters: { acquisition: 'owned', genre: 'x' } });
    expect('bookIds' in data).toBe(false);
  });

  it('elimina la colección', async () => {
    const id = await createManualCollection('alice', 'Borrar', ['a'], alice());
    await deleteCollection('alice', id, alice());
    expect((await getDoc(docOf(alice(), id))).exists()).toBe(false);
  });

  it('las reglas no revisan que los ids existan: una colección tolera libros ya borrados', async () => {
    await expect(createManualCollection('alice', 'Fantasmas', ['no-existe'], alice())).resolves.toEqual(expect.any(String));
  });
});

describe('reglas: qué se acepta al crear', () => {
  it('acepta los documentos válidos', async () => {
    await assertSucceeds(addDoc(collectionsOf(alice()), manual()));
    await assertSucceeds(addDoc(collectionsOf(alice()), filter()));
  });

  it('rechaza un nombre vacío o de más de 60 caracteres, y admite exactamente 60', async () => {
    await assertFails(addDoc(collectionsOf(alice()), manual({ name: '' })));
    await assertFails(addDoc(collectionsOf(alice()), manual({ name: 'a'.repeat(61) })));
    await assertSucceeds(addDoc(collectionsOf(alice()), manual({ name: 'a'.repeat(60) })));
  });

  it('rechaza un tipo desconocido, campos desconocidos y la falta de campos', async () => {
    await assertFails(addDoc(collectionsOf(alice()), manual({ kind: 'smart' })));
    await assertFails(addDoc(collectionsOf(alice()), manual({ extra: 1 })));
    await assertFails(addDoc(collectionsOf(alice()), { kind: 'manual', bookIds: [], createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
  });

  it('una manual no lleva filtros y una filtrada no lleva libros', async () => {
    await assertFails(addDoc(collectionsOf(alice()), manual({ filters: { acquisition: 'owned', genre: 'x' } })));
    await assertFails(addDoc(collectionsOf(alice()), filter({ bookIds: ['a'] })));
  });

  it('una filtrada necesita filtros con la lista y al menos un criterio más', async () => {
    const { filters: _omitted, ...withoutFilters } = filter();
    await assertFails(addDoc(collectionsOf(alice()), withoutFilters));
    await assertFails(addDoc(collectionsOf(alice()), filter({ filters: { acquisition: 'owned' } })));
    await assertFails(addDoc(collectionsOf(alice()), filter({ filters: { genre: 'Fantasía' } })));
  });

  it('rechaza filtros inválidos', async () => {
    await assertFails(addDoc(collectionsOf(alice()), filter({ filters: { acquisition: 'rented', genre: 'x' } })));
    await assertFails(addDoc(collectionsOf(alice()), filter({ filters: { acquisition: 'owned', status: 'dormido' } })));
    await assertFails(addDoc(collectionsOf(alice()), filter({ filters: { acquisition: 'owned', color: 'rojo' } })));
    await assertFails(addDoc(collectionsOf(alice()), filter({ filters: { acquisition: 'owned', genre: 'g'.repeat(201) } })));
    await assertFails(addDoc(collectionsOf(alice()), filter({ filters: { acquisition: 'owned', genre: 5 } })));
  });

  it('acepta todos los criterios a la vez', async () => {
    const filters = { acquisition: 'owned', query: 'dune', status: 'reading', genre: 'Fantasía', author: 'Frank Herbert', series: 'Dune' };
    await assertSucceeds(addDoc(collectionsOf(alice()), filter({ filters })));
  });

  it('admite hasta el máximo de libros y rechaza uno más', async () => {
    const ids = (n: number) => Array.from({ length: n }, (_, index) => `id${index}`);
    await assertSucceeds(addDoc(collectionsOf(alice()), manual({ bookIds: ids(MAX_COLLECTION_BOOKS) })));
    await assertFails(addDoc(collectionsOf(alice()), manual({ bookIds: ids(MAX_COLLECTION_BOOKS + 1) })));
  });

  it('exige que las fechas de control las ponga el servidor', async () => {
    await assertFails(addDoc(collectionsOf(alice()), manual({ createdAt: new Date() })));
    await assertFails(addDoc(collectionsOf(alice()), manual({ updatedAt: new Date() })));
  });
});

describe('reglas: qué se acepta al actualizar', () => {
  it('no se puede cambiar el tipo', async () => {
    const id = await createManualCollection('alice', 'Lista', ['a'], alice());
    await assertFails(
      setDoc(docOf(alice(), id), { name: 'Lista', kind: 'filter', filters: { acquisition: 'owned', genre: 'x' }, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }),
    );
  });

  it('no se puede cambiar la fecha de creación ni dejar el nombre vacío', async () => {
    const id = await createManualCollection('alice', 'Lista', ['a'], alice());
    await assertFails(updateDoc(docOf(alice(), id), { createdAt: new Date(), updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(docOf(alice(), id), { name: '', updatedAt: serverTimestamp() }));
  });

  it('updatedAt debe ser la hora del servidor', async () => {
    const id = await createManualCollection('alice', 'Lista', ['a'], alice());
    await assertFails(updateDoc(docOf(alice(), id), { name: 'Otro', updatedAt: new Date() }));
  });
});

describe('reglas: aislamiento', () => {
  it('otra persona no puede leer, crear, cambiar ni borrar tus colecciones', async () => {
    const id = await createManualCollection('alice', 'Privada', ['a'], alice());
    await assertFails(getDoc(docOf(bob(), id)));
    await assertFails(getDocs(collectionsOf(bob())));
    await assertFails(addDoc(collectionsOf(bob()), manual()));
    await assertFails(updateDoc(docOf(bob(), id), { name: 'Robada', updatedAt: serverTimestamp() }));
    await assertFails(deleteCollection('alice', id, bob()));
  });

  it('sin iniciar sesión no se lee ni se escribe nada', async () => {
    const id = await createManualCollection('alice', 'Privada', ['a'], alice());
    await assertFails(getDoc(docOf(anonymous(), id)));
    await assertFails(addDoc(collectionsOf(anonymous()), manual()));
  });
});

describe('subscribeToCollections', () => {
  const nextBatch = (database: Firestore, uid: string) =>
    new Promise<CollectionWithId[]>((resolve, reject) => {
      const unsubscribe = subscribeToCollections(
        uid,
        (items) => {
          unsubscribe();
          resolve(items);
        },
        reject,
        database,
      );
    });

  it('entrega las colecciones con su id, de la más antigua a la más reciente', async () => {
    const first = await createManualCollection('alice', 'Primera', ['a'], alice());
    const second = await createFilterCollection('alice', 'Segunda', { acquisition: 'owned', genre: 'x' }, alice());
    const items = await nextBatch(alice(), 'alice');
    expect(items.map((item) => item.id)).toEqual([first, second]);
    expect(items.map((item) => item.kind)).toEqual(['manual', 'filter']);
  });

  it('solo entrega las del usuario', async () => {
    await createManualCollection('alice', 'De Alice', [], alice());
    await createManualCollection('bob', 'De Bob', [], bob());
    const items = await nextBatch(alice(), 'alice');
    expect(items.map((item) => item.name)).toEqual(['De Alice']);
  });
});
