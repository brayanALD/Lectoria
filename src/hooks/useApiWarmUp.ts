import { useEffect } from 'react';
import { AppState } from 'react-native';

import { warmUpApi } from '../services/apiClient';

// El hosting gratuito duerme la API tras unos 15 minutos sin tráfico y despertarla tarda de 30 a 60 segundos: sin esto,
// la primera escritura después de un rato (guardar un libro, registrar una lectura) parecería colgada.
const KEEP_ALIVE_MS = 8 * 60_000;
// Al volver a la app no se avisa más de una vez cada tanto, por si se entra y sale seguido.
const MIN_GAP_MS = 2 * 60_000;

/**
 * Mientras haya sesión iniciada y la app esté abierta, mantiene despierta la API: la avisa al entrar, al volver a la app
 * y cada pocos minutos. Es solo un `GET /v1/salud` (sin datos ni sesión) y nunca falla ni se nota en pantalla.
 */
export function useApiWarmUp(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    let last = 0;
    const wake = () => {
      last = Date.now();
      void warmUpApi();
    };
    wake();
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') wake();
    }, KEEP_ALIVE_MS);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && Date.now() - last > MIN_GAP_MS) wake();
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [enabled]);
}
