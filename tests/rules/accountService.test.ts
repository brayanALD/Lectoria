/**
 * @jest-environment node
 */
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDocs, setDoc, setLogLevel, writeBatch, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';

import { deleteAccountData } from '../../src/services/accountService';

// El servicio importa db de firebaseConfig (React Native); en las pruebas se le pasa el Firestore del emulador.
jest.mock('../../firebaseConfig', () => ({ db: {}, auth: {} }));

// Requiere el emulador de Firestore: npm run test:rules
setLogLevel('silent');

let env: RulesTestEnvironment;
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

// Se siembra sin reglas: lo que se prueba es el borrado, no la validación de cada documento.
async function seed(uid: string, books: number, sessions: number, collections = 0): Promise<void> {
  await env.withSecurityRulesDisabled(async (context) => {
    const database = context.firestore() as unknown as Firestore;
    await setDoc(doc(database, 'users', uid), { displayName: uid });
    for (const [name, count] of [['books', books], ['sessions', sessions], ['collections', collections]] as const) {
      for (let start = 0; start < count; start += 400) {
        const batch = writeBatch(database);
        for (let i = start; i < Math.min(start + 400, count); i++) {
          batch.set(doc(database, 'users', uid, name, `${name}-${i}`), { n: i });
        }
        await batch.commit();
      }
    }
  });
}

const count = async (database: Firestore, uid: string, name: string) =>
  (await getDocs(collection(database, 'users', uid, name))).size;
const profileExists = async (uid: string) => {
  let exists = false;
  await env.withSecurityRulesDisabled(async (context) => {
    const snapshot = await getDocs(collection(context.firestore() as unknown as Firestore, 'users'));
    exists = snapshot.docs.some((item) => item.id === uid);
  });
  return exists;
};

describe('deleteAccountData', () => {
  it('borra los libros, las lecturas y el perfil', async () => {
    await seed('alice', 3, 5);
    await deleteAccountData('alice', alice());
    expect(await count(alice(), 'alice', 'books')).toBe(0);
    expect(await count(alice(), 'alice', 'sessions')).toBe(0);
  });

  it('borra también el documento del perfil', async () => {
    await seed('alice', 1, 1);
    expect(await profileExists('alice')).toBe(true);
    await deleteAccountData('alice', alice());
    expect(await profileExists('alice')).toBe(false);
  });

  it('borra también las colecciones y estanterías', async () => {
    await seed('alice', 2, 2, 3);
    expect(await count(alice(), 'alice', 'collections')).toBe(3);
    await deleteAccountData('alice', alice());
    expect(await count(alice(), 'alice', 'collections')).toBe(0);
  });

  it('borra bibliotecas más grandes que un lote', async () => {
    await seed('alice', 10, 850);
    await deleteAccountData('alice', alice());
    expect(await count(alice(), 'alice', 'sessions')).toBe(0);
    expect(await count(alice(), 'alice', 'books')).toBe(0);
  }, 60000);

  it('no toca los datos de otra persona', async () => {
    await seed('alice', 2, 2);
    await seed('bob', 4, 6, 2);
    await deleteAccountData('alice', alice());
    expect(await count(bob(), 'bob', 'collections')).toBe(2);
    expect(await count(bob(), 'bob', 'books')).toBe(4);
    expect(await count(bob(), 'bob', 'sessions')).toBe(6);
    expect(await profileExists('bob')).toBe(true);
  });

  it('una cuenta sin datos tampoco da error, y repetirlo no hace nada', async () => {
    await seed('alice', 0, 0);
    await deleteAccountData('alice', alice());
    await expect(deleteAccountData('alice', alice())).resolves.toBeUndefined();
  });

  it('otra persona no puede borrar tus datos', async () => {
    await seed('alice', 2, 2);
    await expect(deleteAccountData('alice', bob())).rejects.toThrow();
    expect(await count(alice(), 'alice', 'books')).toBe(2);
  });
});
