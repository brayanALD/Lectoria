export const TIMEOUT_ERROR_CODE = 'lectoria/timeout';

/**
 * Rechaza con un error de código `lectoria/timeout` si `promise` no termina en `ms` milisegundos.
 * No cancela la operación original: si más tarde termina bien, simplemente se ignora el resultado.
 * Sirve para las escrituras de Firestore, que sin conexión no terminan hasta recuperar la red.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(Object.assign(new Error('timeout'), { code: TIMEOUT_ERROR_CODE })),
      ms,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
