import AsyncStorage from '@react-native-async-storage/async-storage';

import { parseStoredTimer, serializeTimer, type ReadingTimer } from '../utils/readingTimer';

// El cronómetro es del dispositivo (no se sincroniza): se guarda por usuario para que no se mezcle entre cuentas.
const storageKey = (uid: string) => `lectoria.readingTimer.${uid}`;

/** El cronómetro guardado de ese usuario, o `undefined` si no hay o el dato está dañado. */
export async function loadTimer(uid: string): Promise<ReadingTimer | undefined> {
  return parseStoredTimer(await AsyncStorage.getItem(storageKey(uid)));
}

export async function saveTimer(uid: string, timer: ReadingTimer): Promise<void> {
  await AsyncStorage.setItem(storageKey(uid), serializeTimer(timer));
}

export async function clearTimer(uid: string): Promise<void> {
  await AsyncStorage.removeItem(storageKey(uid));
}
