import { createApiClient, toErrorCode } from './apiClientCore';

const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function setup(fetchFn: jest.Mock, options: { baseUrl?: string; timeoutMs?: number; getToken?: () => Promise<string> } = {}) {
  return createApiClient({
    baseUrl: options.baseUrl ?? 'https://api.test/',
    getToken: options.getToken ?? (async () => 'token-123'),
    fetchFn: fetchFn as unknown as typeof fetch,
    timeoutMs: options.timeoutMs,
  });
}

async function failure(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return error as Error & { code: string; status?: number; apiCode?: string; fields?: Record<string, string> };
  }
  throw new Error('Se esperaba un error');
}

describe('createApiClient', () => {
  it('envía el token de la sesión, el cuerpo en JSON y quita la barra final de la dirección', async () => {
    const fetchFn = jest.fn().mockResolvedValue(json(201, { id: 'abc' }));
    const result = await setup(fetchFn).post<{ id: string }>('/v1/books', { title: 'Dune' });

    expect(result).toEqual({ id: 'abc' });
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('https://api.test/v1/books');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer token-123', 'Content-Type': 'application/json' });
    expect(init.body).toBe('{"title":"Dune"}');
  });

  it('una respuesta 204 devuelve undefined y una solicitud sin cuerpo no declara Content-Type', async () => {
    const fetchFn = jest.fn().mockResolvedValue(new Response(null, { status: 204 }));
    expect(await setup(fetchFn).delete('/v1/sessions/s1')).toBeUndefined();
    expect(fetchFn.mock.calls[0][1].headers['Content-Type']).toBeUndefined();
    expect(fetchFn.mock.calls[0][1].body).toBeUndefined();
  });

  it('sin la API configurada falla antes de salir a la red', async () => {
    const fetchFn = jest.fn();
    const error = await failure(setup(fetchFn, { baseUrl: '' }).get('/v1/me'));
    expect(error.code).toBe('lectoria/api-not-configured');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('sin sesión no llama a la API y lo trata como un error de permisos', async () => {
    const fetchFn = jest.fn();
    const error = await failure(
      setup(fetchFn, { getToken: async () => Promise.reject(Object.assign(new Error('x'), { code: 'auth/no-user' })) }).get('/v1/me'),
    );
    expect(error.code).toBe('unauthenticated');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('si no se puede renovar el token por falta de red, es un error de conexión', async () => {
    const error = await failure(
      setup(jest.fn(), { getToken: async () => Promise.reject(Object.assign(new Error('x'), { code: 'auth/network-request-failed' })) }).get('/v1/me'),
    );
    expect(error.code).toBe('unavailable');
  });

  it('un fallo de red es «unavailable»', async () => {
    const fetchFn = jest.fn().mockRejectedValue(new TypeError('Network request failed'));
    expect((await failure(setup(fetchFn).get('/v1/me'))).code).toBe('unavailable');
  });

  it('si la API no responde a tiempo aborta la solicitud y lo informa como tiempo agotado', async () => {
    jest.useFakeTimers();
    try {
      const fetchFn = jest.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })));
      }));
      const pending = failure(setup(fetchFn as unknown as jest.Mock, { timeoutMs: 5000 }).post('/v1/books', {}));
      await jest.advanceTimersByTimeAsync(5001);
      expect((await pending).code).toBe('lectoria/timeout');
    } finally {
      jest.useRealTimers();
    }
  });

  it('un 400 conserva el mensaje y los errores por campo', async () => {
    const fetchFn = jest.fn().mockResolvedValue(
      json(400, { error: { code: 'VALIDATION', message: 'Los datos enviados no son válidos.', fields: { title: 'Introduce el título.' } } }),
    );
    const error = await failure(setup(fetchFn).post('/v1/books', {}));
    expect(error).toMatchObject({
      code: 'invalid-argument',
      status: 400,
      apiCode: 'VALIDATION',
      fields: { title: 'Introduce el título.' },
      message: 'Los datos enviados no son válidos.',
    });
  });

  it('una página de error del hosting (no JSON) mientras el servicio despierta es «servidor no disponible»', async () => {
    const fetchFn = jest.fn().mockResolvedValue(new Response('<html>Service waking up</html>', { status: 503 }));
    const error = await failure(setup(fetchFn).get('/v1/me'));
    expect(error.code).toBe('lectoria/server-unavailable');
    expect(error.status).toBe(503);
  });

  it('una respuesta correcta que no es JSON es un error interno', async () => {
    const fetchFn = jest.fn().mockResolvedValue(new Response('<html>hola</html>', { status: 200 }));
    expect((await failure(setup(fetchFn).get('/v1/me'))).code).toBe('internal');
  });

  it('ping despierta el servicio sin sesión y nunca lanza', async () => {
    const ok = jest.fn().mockResolvedValue(json(200, { status: 'ok' }));
    expect(await setup(ok).ping()).toBe(true);
    expect(ok.mock.calls[0][0]).toBe('https://api.test/v1/salud');
    expect(ok.mock.calls[0][1].headers).toBeUndefined();

    expect(await setup(jest.fn().mockRejectedValue(new TypeError('x'))).ping()).toBe(false);
    expect(await setup(jest.fn().mockResolvedValue(json(503))).ping()).toBe(false);
    expect(await setup(jest.fn(), { baseUrl: '' }).ping()).toBe(false);
  });
});

describe('toErrorCode', () => {
  it.each([
    [400, undefined, 'invalid-argument'],
    [401, undefined, 'unauthenticated'],
    [404, undefined, 'not-found'],
    [409, 'BOOK_NOT_OWNED', 'lectoria/book-not-owned'],
    [409, 'OTRO', 'failed-precondition'],
    [429, 'RATE_LIMITED', 'resource-exhausted'],
    [429, 'CATALOG_RATE_LIMITED', 'lectoria/catalog-rate-limited'],
    [502, 'CATALOG_UNAVAILABLE', 'lectoria/catalog-unavailable'],
    [502, undefined, 'lectoria/server-unavailable'],
    [503, 'BUSY', 'lectoria/server-unavailable'],
    [504, undefined, 'lectoria/server-unavailable'],
    [500, 'INTERNAL', 'internal'],
  ])('%i %s -> %s', (status, apiCode, expected) => {
    expect(toErrorCode(status, apiCode)).toBe(expected);
  });
});
