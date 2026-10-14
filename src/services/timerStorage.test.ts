import AsyncStorage from '@react-native-async-storage/async-storage';

import { pauseTimer, startTimer } from '../utils/readingTimer';
import { clearTimer, loadTimer, saveTimer } from './timerStorage';

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

const T0 = new Date('2026-10-13T15:00:00Z').getTime();

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('timerStorage', () => {
  it('sin nada guardado no hay cronómetro', async () => {
    expect(await loadTimer('alice')).toBeUndefined();
  });

  it('guarda y recupera un cronómetro en marcha (sobrevive a cerrar la app)', async () => {
    const timer = startTimer('libro1', T0);
    await saveTimer('alice', timer);
    expect(await loadTimer('alice')).toEqual(timer);
  });

  it('guarda y recupera un cronómetro en pausa', async () => {
    const timer = pauseTimer(startTimer('libro1', T0), T0 + 60_000);
    await saveTimer('alice', timer);
    expect(await loadTimer('alice')).toEqual(timer);
  });

  it('guardar de nuevo sustituye el valor anterior', async () => {
    await saveTimer('alice', startTimer('libro1', T0));
    const paused = pauseTimer(startTimer('libro1', T0), T0 + 5_000);
    await saveTimer('alice', paused);
    expect(await loadTimer('alice')).toEqual(paused);
  });

  it('cada usuario tiene su propio cronómetro', async () => {
    await saveTimer('alice', startTimer('libro-de-alice', T0));
    expect(await loadTimer('bob')).toBeUndefined();
    await saveTimer('bob', startTimer('libro-de-bob', T0));
    expect((await loadTimer('alice'))?.bookId).toBe('libro-de-alice');
    expect((await loadTimer('bob'))?.bookId).toBe('libro-de-bob');
  });

  it('descartar elimina el cronómetro, solo el de ese usuario', async () => {
    await saveTimer('alice', startTimer('libro1', T0));
    await saveTimer('bob', startTimer('libro2', T0));
    await clearTimer('alice');
    expect(await loadTimer('alice')).toBeUndefined();
    expect(await loadTimer('bob')).toBeDefined();
  });

  it('un dato dañado en el almacenamiento se ignora en lugar de romper la app', async () => {
    await AsyncStorage.setItem('lectoria.readingTimer.alice', '{"bookId":');
    expect(await loadTimer('alice')).toBeUndefined();
  });
});
