/**
 * @jest-environment node
 */
import { assertFails, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, serverTimestamp, setDoc, setLogLevel, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';

import { setDailyGoal, subscribeToDailyGoal } from '../../src/services/userService';

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
  // El perfil lo crea la app al iniciar sesión (`ensureUserProfile`).
  await setDoc(doc(alice(), 'users', 'alice'), { createdAt: serverTimestamp(), timeZone: 'UTC', displayName: 'Alice' });
});

const storedGoal = async () => (await getDoc(doc(alice(), 'users', 'alice'))).data()?.dailyGoalMinutes;

describe('setDailyGoal', () => {
  it('guarda la meta en el perfil sin tocar el resto de sus datos', async () => {
    await setDailyGoal('alice', 30, alice());
    expect(await storedGoal()).toBe(30);
    expect((await getDoc(doc(alice(), 'users', 'alice'))).data()).toMatchObject({ displayName: 'Alice', timeZone: 'UTC' });
  });

  it('cambiar la meta sustituye la anterior', async () => {
    await setDailyGoal('alice', 30, alice());
    await setDailyGoal('alice', 45, alice());
    expect(await storedGoal()).toBe(45);
  });

  it('quitar la meta elimina el campo', async () => {
    await setDailyGoal('alice', 30, alice());
    await setDailyGoal('alice', undefined, alice());
    expect((await getDoc(doc(alice(), 'users', 'alice'))).data()).not.toHaveProperty('dailyGoalMinutes');
  });

  it.each([[0], [1441], [-5], [12.5]])('las reglas rechazan una meta de %s minutos', async (minutes) => {
    await assertFails(setDailyGoal('alice', minutes, alice()));
    expect(await storedGoal()).toBeUndefined();
  });

  it('acepta los límites: 1 y 1440 minutos', async () => {
    await setDailyGoal('alice', 1, alice());
    expect(await storedGoal()).toBe(1);
    await setDailyGoal('alice', 1440, alice());
    expect(await storedGoal()).toBe(1440);
  });

  it('un usuario no puede cambiar la meta de otro', async () => {
    await assertFails(setDailyGoal('alice', 30, bob()));
    expect(await storedGoal()).toBeUndefined();
  });
});

describe('subscribeToDailyGoal', () => {
  const next = (database: Firestore, until: (minutes: number | undefined) => boolean = () => true) =>
    new Promise<number | undefined>((resolve, reject) => {
      const unsubscribe = subscribeToDailyGoal(
        'alice',
        (minutes) => {
          if (until(minutes)) {
            unsubscribe();
            resolve(minutes);
          }
        },
        reject,
        database,
      );
    });

  it('sin meta devuelve undefined', async () => {
    expect(await next(alice())).toBeUndefined();
  });

  it('devuelve la meta guardada y se entera de los cambios', async () => {
    await setDailyGoal('alice', 25, alice());
    expect(await next(alice())).toBe(25);

    const changed = next(alice(), (minutes) => minutes === 50);
    await setDailyGoal('alice', 50, alice());
    expect(await changed).toBe(50);
  });

  it('un usuario no puede leer la meta de otro', async () => {
    await expect(next(bob())).rejects.toBeDefined();
  });
});
