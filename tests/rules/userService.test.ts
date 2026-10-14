/**
 * @jest-environment node
 */
import { assertFails, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, serverTimestamp, setDoc, setLogLevel, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';

import { setDailyGoal, subscribeToDailyGoal } from '../../src/services/userService';
import type { DailyGoal } from '../../src/types/goal';

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

const profileData = async () => (await getDoc(doc(alice(), 'users', 'alice'))).data();
const minutes = (target: number): DailyGoal => ({ type: 'minutes', target });
const pages = (target: number): DailyGoal => ({ type: 'pages', target });

describe('setDailyGoal', () => {
  it('guarda una meta de minutos en el perfil sin tocar el resto de sus datos', async () => {
    await setDailyGoal('alice', minutes(30), alice());
    expect(await profileData()).toMatchObject({ dailyGoalMinutes: 30, displayName: 'Alice', timeZone: 'UTC' });
    expect(await profileData()).not.toHaveProperty('dailyGoalPages');
  });

  it('guarda una meta de páginas en su propio campo', async () => {
    await setDailyGoal('alice', pages(20), alice());
    expect(await profileData()).toMatchObject({ dailyGoalPages: 20, displayName: 'Alice' });
    expect(await profileData()).not.toHaveProperty('dailyGoalMinutes');
  });

  it('cambiar el valor sustituye el anterior', async () => {
    await setDailyGoal('alice', minutes(30), alice());
    await setDailyGoal('alice', minutes(45), alice());
    expect((await profileData())?.dailyGoalMinutes).toBe(45);
  });

  it('cambiar de tipo deja un solo campo: pasar de minutos a páginas y volver', async () => {
    await setDailyGoal('alice', minutes(30), alice());
    await setDailyGoal('alice', pages(15), alice());
    let data = await profileData();
    expect(data).toMatchObject({ dailyGoalPages: 15 });
    expect(data).not.toHaveProperty('dailyGoalMinutes');

    await setDailyGoal('alice', minutes(40), alice());
    data = await profileData();
    expect(data).toMatchObject({ dailyGoalMinutes: 40 });
    expect(data).not.toHaveProperty('dailyGoalPages');
  });

  it('quitar la meta elimina los dos campos, sea del tipo que sea', async () => {
    await setDailyGoal('alice', pages(20), alice());
    await setDailyGoal('alice', undefined, alice());
    expect(await profileData()).not.toHaveProperty('dailyGoalPages');
    expect(await profileData()).not.toHaveProperty('dailyGoalMinutes');

    await setDailyGoal('alice', minutes(20), alice());
    await setDailyGoal('alice', undefined, alice());
    expect(await profileData()).not.toHaveProperty('dailyGoalMinutes');
  });

  it.each([[0], [1441], [-5], [12.5]])('las reglas rechazan una meta de %s minutos', async (target) => {
    await assertFails(setDailyGoal('alice', minutes(target), alice()));
    expect(await profileData()).not.toHaveProperty('dailyGoalMinutes');
  });

  it.each([[0], [10001], [-5], [12.5]])('las reglas rechazan una meta de %s páginas', async (target) => {
    await assertFails(setDailyGoal('alice', pages(target), alice()));
    expect(await profileData()).not.toHaveProperty('dailyGoalPages');
  });

  it('acepta los límites de cada tipo', async () => {
    await setDailyGoal('alice', minutes(1), alice());
    await setDailyGoal('alice', minutes(1440), alice());
    expect((await profileData())?.dailyGoalMinutes).toBe(1440);
    await setDailyGoal('alice', pages(1), alice());
    await setDailyGoal('alice', pages(10000), alice());
    expect((await profileData())?.dailyGoalPages).toBe(10000);
  });

  it('un usuario no puede cambiar la meta de otro', async () => {
    await assertFails(setDailyGoal('alice', pages(30), bob()));
    expect(await profileData()).not.toHaveProperty('dailyGoalPages');
  });
});

describe('subscribeToDailyGoal', () => {
  const next = (database: Firestore, until: (goal: DailyGoal | undefined) => boolean = () => true) =>
    new Promise<DailyGoal | undefined>((resolve, reject) => {
      const unsubscribe = subscribeToDailyGoal(
        'alice',
        (goal) => {
          if (until(goal)) {
            unsubscribe();
            resolve(goal);
          }
        },
        reject,
        database,
      );
    });

  it('sin meta devuelve undefined', async () => {
    expect(await next(alice())).toBeUndefined();
  });

  it('devuelve la meta con su tipo', async () => {
    await setDailyGoal('alice', minutes(25), alice());
    expect(await next(alice())).toEqual(minutes(25));
    await setDailyGoal('alice', pages(12), alice());
    expect(await next(alice())).toEqual(pages(12));
  });

  it('una meta antigua, que solo tiene `dailyGoalMinutes`, se lee como de minutos sin migrar nada', async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users', 'alice'), { createdAt: serverTimestamp(), timeZone: 'UTC', dailyGoalMinutes: 35 });
    });
    expect(await next(alice())).toEqual(minutes(35));
  });

  it('se entera de los cambios, también al cambiar de tipo', async () => {
    const toPages = next(alice(), (goal) => goal?.type === 'pages');
    await setDailyGoal('alice', minutes(50), alice());
    await setDailyGoal('alice', pages(8), alice());
    expect(await toPages).toEqual(pages(8));
  });

  it('un usuario no puede leer la meta de otro', async () => {
    await expect(next(bob())).rejects.toBeDefined();
  });
});
