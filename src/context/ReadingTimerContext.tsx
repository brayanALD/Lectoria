import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { clearTimer, loadTimer, saveTimer } from '../services/timerStorage';
import { pauseTimer, resumeTimer, startTimer, type ReadingTimer } from '../utils/readingTimer';
import { useAuth } from './AuthContext';

interface ReadingTimerValue {
  /** El cronómetro del usuario, o `undefined` si no hay ninguno (solo hay uno a la vez). */
  timer: ReadingTimer | undefined;
  /** true hasta recuperar el cronómetro guardado en el dispositivo. */
  loading: boolean;
  /** Inicia el cronómetro de un libro. Si ya hay uno, no hace nada: nunca hay dos a la vez. */
  start: (bookId: string) => void;
  pause: () => void;
  resume: () => void;
  /** Elimina el cronómetro (al registrar la lectura o al descartarlo). */
  discard: () => void;
}

const ReadingTimerContext = createContext<ReadingTimerValue | undefined>(undefined);

/**
 * El cronómetro de lectura vive aquí, no en una pantalla: así sigue al cambiar de pantalla, y se guarda en el
 * dispositivo (`timerStorage`) para recuperarlo si la app se cierra o el sistema la detiene. Solo guarda las marcas de
 * tiempo (ver `utils/readingTimer`); quien lo muestra calcula el tiempo con ellas. Va dentro de `AuthProvider`.
 */
export function ReadingTimerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user?.uid;

  const [state, setState] = useState<{ loading: boolean; timer: ReadingTimer | undefined }>({ loading: true, timer: undefined });
  // Espejo síncrono del cronómetro: dos pulsaciones seguidas no deben leer un estado anterior (p. ej. iniciar dos veces).
  const timerRef = useRef<ReadingTimer | undefined>(undefined);

  useEffect(() => {
    timerRef.current = undefined;
    if (!uid) {
      setState({ loading: false, timer: undefined });
      return;
    }
    let cancelled = false;
    setState({ loading: true, timer: undefined });
    loadTimer(uid)
      .catch((error) => {
        console.warn('No se pudo recuperar el cronómetro', error);
        return undefined;
      })
      .then((stored) => {
        if (cancelled) return;
        timerRef.current = stored;
        setState({ loading: false, timer: stored });
      });
    return () => {
      cancelled = true;
    };
  }, [uid]);

  const apply = useCallback(
    (next: ReadingTimer | undefined) => {
      timerRef.current = next;
      setState({ loading: false, timer: next });
      if (!uid) return;
      (next ? saveTimer(uid, next) : clearTimer(uid)).catch((error) => {
        console.warn('No se pudo guardar el cronómetro', error);
      });
    },
    [uid],
  );

  const start = useCallback(
    (bookId: string) => {
      if (timerRef.current) return;
      apply(startTimer(bookId, Date.now()));
    },
    [apply],
  );
  const pause = useCallback(() => {
    if (timerRef.current) apply(pauseTimer(timerRef.current, Date.now()));
  }, [apply]);
  const resume = useCallback(() => {
    if (timerRef.current) apply(resumeTimer(timerRef.current, Date.now()));
  }, [apply]);
  const discard = useCallback(() => {
    if (timerRef.current) apply(undefined);
  }, [apply]);

  const value = useMemo<ReadingTimerValue>(
    () => ({ timer: state.timer, loading: state.loading, start, pause, resume, discard }),
    [state, start, pause, resume, discard],
  );

  return <ReadingTimerContext.Provider value={value}>{children}</ReadingTimerContext.Provider>;
}

export function useReadingTimer(): ReadingTimerValue {
  const value = useContext(ReadingTimerContext);
  if (!value) throw new Error('useReadingTimer debe usarse dentro de ReadingTimerProvider');
  return value;
}
