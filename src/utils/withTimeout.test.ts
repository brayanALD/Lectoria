import { TIMEOUT_ERROR_CODE, withTimeout } from './withTimeout';

describe('withTimeout', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('devuelve el valor si la promesa termina a tiempo', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 1000)).resolves.toBe('ok');
  });

  it('propaga el error original si la promesa falla a tiempo', async () => {
    const error = Object.assign(new Error('x'), { code: 'permission-denied' });
    await expect(withTimeout(Promise.reject(error), 1000)).rejects.toBe(error);
  });

  it('rechaza con el código de tiempo agotado si la promesa no termina', async () => {
    const pending = new Promise<string>(() => {});
    const result = withTimeout(pending, 1000);
    const assertion = expect(result).rejects.toMatchObject({ code: TIMEOUT_ERROR_CODE });
    jest.advanceTimersByTime(1000);
    await assertion;
  });

  it('no rechaza antes de que se cumpla el tiempo', async () => {
    let settled = false;
    const result = withTimeout(new Promise<string>(() => {}), 1000).catch(() => (settled = true));
    jest.advanceTimersByTime(999);
    await Promise.resolve();
    expect(settled).toBe(false);
    jest.advanceTimersByTime(1);
    await result;
    expect(settled).toBe(true);
  });

  it('limpia el temporizador cuando la promesa termina', async () => {
    await withTimeout(Promise.resolve(1), 1000);
    expect(jest.getTimerCount()).toBe(0);
  });
});
