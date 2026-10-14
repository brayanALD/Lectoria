import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/**
 * La hora actual en milisegundos, actualizada cada `intervalMs`. Sin intervalo (`undefined`) no avanza sola.
 * Solo sirve para repintar: lo que se mide (p. ej. el cronómetro) se calcula con marcas de tiempo, así que un
 * tick perdido en segundo plano no afecta al resultado. Al volver a la app se actualiza de inmediato.
 */
export function useNow(intervalMs: number | undefined): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setNow(Date.now());
    if (intervalMs === undefined) return;
    const interval = setInterval(() => setNow(Date.now()), intervalMs);
    const subscription = AppState.addEventListener('change', (state) => state === 'active' && setNow(Date.now()));
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [intervalMs]);

  return now;
}
