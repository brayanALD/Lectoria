import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import type { Ctx } from '../../src/context';
import { ApiError } from '../../src/errors';
import {
  clearCatalogCache,
  findBookByIsbn,
  parseGoogleBooksResponse,
  parseOpenLibraryResponse,
} from '../../src/services/catalog';

const ISBN = '9780980200447';

// Respuesta con la forma documentada por Open Library para `jscmd=data`.
const payload = (overrides: Record<string, unknown> = {}) => ({
  [`ISBN:${ISBN}`]: {
    title: 'Slow reading',
    authors: [{ name: 'John Miedema', url: 'https://openlibrary.org/authors/OL3965372A/John_Miedema' }],
    number_of_pages: 80,
    cover: {
      small: 'https://covers.openlibrary.org/b/id/5546156-S.jpg',
      medium: 'https://covers.openlibrary.org/b/id/5546156-M.jpg',
      large: 'https://covers.openlibrary.org/b/id/5546156-L.jpg',
    },
    subjects: [{ name: 'Books and reading', url: 'x' }],
    ...overrides,
  },
});

const response = (body: unknown, init: { status?: number } = {}) =>
  ({ ok: (init.status ?? 200) < 400, status: init.status ?? 200, json: async () => body }) as Response;

beforeEach(() => clearCatalogCache());

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

/** Un contexto de servicio con solo lo que usa el catálogo. */
function ctxWith(fetchFn: FetchFn, config: Partial<Ctx['config']> = {}): Ctx & { calls: { url: string; init?: RequestInit }[] } {
  const calls: { url: string; init?: RequestInit }[] = [];
  return {
    calls,
    db: undefined as unknown as Ctx['db'],
    now: () => new Date('2026-10-13T15:00:00Z'),
    config: { openLibraryContact: '', googleBooksKey: '', ...config },
    fetchFn: (async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return fetchFn(String(url), init);
    }) as typeof fetch,
    log: console,
  };
}

const rejectsWith = (promise: Promise<unknown>, status: number, code: string) =>
  assert.rejects(promise, (error: unknown) => error instanceof ApiError && error.status === status && error.code === code);

describe('parseOpenLibraryResponse', () => {
  it('extrae título, autores, páginas y la portada mediana', () => {
    assert.deepEqual(parseOpenLibraryResponse(payload(), ISBN), {
      isbn13: ISBN,
      title: 'Slow reading',
      authors: ['John Miedema'],
      pageCount: 80,
      coverUrl: 'https://covers.openlibrary.org/b/id/5546156-M.jpg',
    });
  });

  it('añade el subtítulo al título', () => {
    assert.equal(parseOpenLibraryResponse(payload({ subtitle: 'una guía' }), ISBN)?.title, 'Slow reading: una guía');
  });

  it('devuelve null cuando el catálogo no conoce el ISBN o la respuesta no tiene la forma esperada', () => {
    for (const body of [{}, null, 'texto', [], { [`ISBN:${ISBN}`]: 5 }]) {
      assert.equal(parseOpenLibraryResponse(body, ISBN), null);
    }
  });

  it('devuelve null si no hay título utilizable', () => {
    assert.equal(parseOpenLibraryResponse(payload({ title: '   ' }), ISBN), null);
    assert.equal(parseOpenLibraryResponse(payload({ title: 42 }), ISBN), null);
  });

  it('acepta un libro sin autores, páginas ni portada, y no incluye claves vacías', () => {
    const book = parseOpenLibraryResponse({ [`ISBN:${ISBN}`]: { title: 'Solo título' } }, ISBN);
    assert.deepEqual(book, { isbn13: ISBN, title: 'Solo título', authors: [] });
    assert.deepEqual(Object.keys(book!), ['isbn13', 'title', 'authors']);
  });

  it('descarta páginas fuera de rango o no enteras, en lugar de fallar', () => {
    for (const pages of [0, -5, 1.5, 'cien', 10_000_000, null]) {
      assert.equal(parseOpenLibraryResponse(payload({ number_of_pages: pages }), ISBN)?.pageCount, undefined);
    }
  });

  it('ignora autores sin nombre y limita el número de autores', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ name: `Autor ${i}` }));
    const book = parseOpenLibraryResponse(payload({ authors: [{ url: 'x' }, { name: '  ' }, ...many] }), ISBN);
    assert.equal(book?.authors.length, 20);
    assert.equal(book?.authors[0], 'Autor 0');
  });

  it('solo acepta portadas https; si la mediana no sirve usa otra', () => {
    const fromLarge = parseOpenLibraryResponse(
      payload({ cover: { medium: 'http://inseguro/m.jpg', large: 'https://covers.openlibrary.org/l.jpg' } }),
      ISBN,
    );
    assert.equal(fromLarge?.coverUrl, 'https://covers.openlibrary.org/l.jpg');
    assert.equal(parseOpenLibraryResponse(payload({ cover: { medium: 'http://inseguro/m.jpg' } }), ISBN)?.coverUrl, undefined);
  });

  it('recorta un título demasiado largo al límite del libro', () => {
    assert.equal(parseOpenLibraryResponse(payload({ title: 'a'.repeat(500) }), ISBN)?.title.length, 300);
  });
});

describe('findBookByIsbn (Open Library)', () => {
  it('consulta el endpoint con el ISBN, formato JSON y datos completos', async () => {
    const ctx = ctxWith(async () => response(payload()));
    const { book } = await findBookByIsbn(ctx, ISBN);
    assert.equal(book?.title, 'Slow reading');
    assert.equal(ctx.calls[0].url, `https://openlibrary.org/api/books?bibkeys=ISBN:${ISBN}&jscmd=data&format=json`);
    assert.match((ctx.calls[0].init?.headers as Record<string, string>)['User-Agent'], /^Lectoria/);
  });

  it('devuelve book: null si el ISBN no está en el catálogo', async () => {
    assert.deepEqual(await findBookByIsbn(ctxWith(async () => response({})), ISBN), { book: null });
  });

  it('un 429 es «demasiadas consultas» (429 CATALOG_RATE_LIMITED)', async () => {
    await rejectsWith(findBookByIsbn(ctxWith(async () => response({}, { status: 429 })), ISBN), 429, 'CATALOG_RATE_LIMITED');
  });

  it('un error del servidor es «no disponible» (502 CATALOG_UNAVAILABLE)', async () => {
    await rejectsWith(findBookByIsbn(ctxWith(async () => response({}, { status: 503 })), ISBN), 502, 'CATALOG_UNAVAILABLE');
  });

  it('sin red, con la petición cancelada o con una respuesta que no es JSON también es «no disponible»', async () => {
    const down = ctxWith(async () => {
      throw new TypeError('fetch failed');
    });
    await rejectsWith(findBookByIsbn(down, ISBN), 502, 'CATALOG_UNAVAILABLE');

    const aborted = ctxWith(async () => {
      throw new DOMException('Aborted', 'AbortError');
    });
    await rejectsWith(findBookByIsbn(aborted, ISBN), 502, 'CATALOG_UNAVAILABLE');

    const notJson = ctxWith(
      async () =>
        ({
          ok: true,
          status: 200,
          json: async () => {
            throw new SyntaxError('Unexpected token <');
          },
        }) as unknown as Response,
    );
    await rejectsWith(findBookByIsbn(notJson, ISBN), 502, 'CATALOG_UNAVAILABLE');
  });
});

// Respuesta con la forma documentada por Google Books para `volumes?q=isbn:…`.
const volume = (overrides: Record<string, unknown> = {}, identifiers: unknown = [{ type: 'ISBN_13', identifier: ISBN }]) => ({
  volumeInfo: {
    title: 'Slow reading',
    authors: ['John Miedema'],
    pageCount: 80,
    industryIdentifiers: identifiers,
    imageLinks: {
      smallThumbnail: 'http://books.google.com/books/content?id=abc&printsec=frontcover&img=1&zoom=5&edge=curl&source=gbs_api',
      thumbnail: 'http://books.google.com/books/content?id=abc&printsec=frontcover&img=1&zoom=1&edge=curl&source=gbs_api',
    },
    ...overrides,
  },
});
const googlePayload = (...items: unknown[]) => ({ items });

describe('parseGoogleBooksResponse', () => {
  it('extrae título, autores, páginas y portada (pasada a https y sin la esquina doblada)', () => {
    assert.deepEqual(parseGoogleBooksResponse(googlePayload(volume()), ISBN), {
      isbn13: ISBN,
      title: 'Slow reading',
      authors: ['John Miedema'],
      pageCount: 80,
      coverUrl: 'https://books.google.com/books/content?id=abc&printsec=frontcover&img=1&zoom=1&source=gbs_api',
    });
  });

  it('añade el subtítulo al título', () => {
    assert.equal(parseGoogleBooksResponse(googlePayload(volume({ subtitle: 'una guía' })), ISBN)?.title, 'Slow reading: una guía');
  });

  it('devuelve null si no hay resultados o la respuesta no tiene la forma esperada', () => {
    for (const body of [{}, { totalItems: 0 }, googlePayload(), null, 'texto', { items: 5 }, googlePayload(null, 7, {})]) {
      assert.equal(parseGoogleBooksResponse(body, ISBN), null);
    }
  });

  it('descarta un volumen que no declara ese ISBN-13 (falsos positivos de la búsqueda libre)', () => {
    const other = volume({ title: 'Manual de programación' }, [{ type: 'ISBN_13', identifier: '9788466329125' }]);
    assert.equal(parseGoogleBooksResponse(googlePayload(other), ISBN), null);
    assert.equal(parseGoogleBooksResponse(googlePayload(volume({}, [])), ISBN), null);
    assert.equal(parseGoogleBooksResponse(googlePayload(volume({}, null)), ISBN), null);
    // Un ISBN-10 igual de parecido no sirve: tiene que ser el ISBN-13 pedido.
    assert.equal(parseGoogleBooksResponse(googlePayload(volume({}, [{ type: 'ISBN_10', identifier: '0980200441' }])), ISBN), null);
  });

  it('elige el volumen que coincide aunque no sea el primero, y acepta un identificador con guiones', () => {
    const other = volume({ title: 'Otro libro' }, [{ type: 'ISBN_13', identifier: '9788466329125' }]);
    assert.equal(parseGoogleBooksResponse(googlePayload(other, volume()), ISBN)?.title, 'Slow reading');
    const hyphenated = volume({}, [{ type: 'ISBN_13', identifier: '978-0-9802004-4-7' }]);
    assert.equal(parseGoogleBooksResponse(googlePayload(hyphenated), ISBN)?.title, 'Slow reading');
  });

  it('devuelve null si el volumen no tiene título utilizable', () => {
    assert.equal(parseGoogleBooksResponse(googlePayload(volume({ title: '  ' })), ISBN), null);
    assert.equal(parseGoogleBooksResponse(googlePayload(volume({ title: 3 })), ISBN), null);
  });

  it('acepta un libro sin autores, páginas ni portada, y no incluye claves vacías', () => {
    const bare = { volumeInfo: { title: 'Solo título', industryIdentifiers: [{ type: 'ISBN_13', identifier: ISBN }] } };
    const book = parseGoogleBooksResponse(googlePayload(bare), ISBN);
    assert.deepEqual(book, { isbn13: ISBN, title: 'Solo título', authors: [] });
  });

  it('descarta páginas fuera de rango y usa la miniatura pequeña si la grande no sirve', () => {
    assert.equal(parseGoogleBooksResponse(googlePayload(volume({ pageCount: 0 })), ISBN)?.pageCount, undefined);
    assert.equal(parseGoogleBooksResponse(googlePayload(volume({ pageCount: 12.5 })), ISBN)?.pageCount, undefined);
    const smallOnly = volume({ imageLinks: { thumbnail: 'ftp://x', smallThumbnail: 'http://books.google.com/small' } });
    assert.equal(parseGoogleBooksResponse(googlePayload(smallOnly), ISBN)?.coverUrl, 'https://books.google.com/small');
  });
});

describe('findBookByIsbn con respaldo de Google Books', () => {
  const KEY = 'clave-de-prueba';
  const isGoogle = (url: string) => url.startsWith('https://www.googleapis.com/books/v1/volumes');

  /** `fetch` que contesta según el proveedor al que va la petición. */
  const router = (open: () => Promise<Response>, google: () => Promise<Response>, config: Partial<Ctx['config']> = { googleBooksKey: KEY }) =>
    ctxWith((url) => (isGoogle(url) ? google() : open()), config);

  const googleCalls = (ctx: { calls: { url: string; init?: RequestInit }[] }) => ctx.calls.filter((call) => isGoogle(call.url));

  it('si Open Library lo encuentra, no consulta Google Books', async () => {
    const ctx = router(async () => response(payload()), async () => response(googlePayload(volume())));
    assert.equal((await findBookByIsbn(ctx, ISBN)).book?.title, 'Slow reading');
    assert.equal(ctx.calls.length, 1);
  });

  it('si Open Library no lo conoce, lo busca en Google Books con la clave y solo con isbn:', async () => {
    const ctx = router(async () => response({}), async () => response(googlePayload(volume({ title: 'Del respaldo' }))));
    const { book } = await findBookByIsbn(ctx, ISBN);
    assert.equal(book?.title, 'Del respaldo');
    assert.equal(book?.pageCount, 80);
    const url = googleCalls(ctx)[0].url;
    assert.ok(url.includes(`q=isbn:${ISBN}`));
    assert.ok(url.includes(`key=${KEY}`));
  });

  it('si Open Library falla (503 o 429), Google Books responde por él', async () => {
    for (const status of [503, 429]) {
      clearCatalogCache();
      const ctx = router(async () => response({}, { status }), async () => response(googlePayload(volume())));
      assert.equal((await findBookByIsbn(ctx, ISBN)).book?.title, 'Slow reading');
    }
  });

  it('si ninguno lo conoce, o Google devuelve un volumen con otro ISBN, responde book: null', async () => {
    const none = router(async () => response({}), async () => response({ totalItems: 0 }));
    assert.deepEqual(await findBookByIsbn(none, ISBN), { book: null });

    clearCatalogCache();
    const wrong = volume({ title: 'Libro equivocado' }, [{ type: 'ISBN_13', identifier: '9788466329125' }]);
    const wrongCtx = router(async () => response({}), async () => response(googlePayload(wrong)));
    assert.deepEqual(await findBookByIsbn(wrongCtx, ISBN), { book: null });
  });

  it('reintenta una vez si Google Books responde 503 y usa la segunda respuesta', async () => {
    let calls = 0;
    const ctx = router(async () => response({}), async () => (++calls === 1 ? response({}, { status: 503 }) : response(googlePayload(volume()))));
    assert.equal((await findBookByIsbn(ctx, ISBN)).book?.title, 'Slow reading');
    assert.equal(calls, 2);
  });

  it('no reintenta más de una vez: dos 503 seguidos dejan «no encontrado»', async () => {
    let calls = 0;
    const ctx = router(async () => response({}), async () => (++calls, response({}, { status: 503 })));
    assert.deepEqual(await findBookByIsbn(ctx, ISBN), { book: null });
    assert.equal(calls, 2);
  });

  it('no reintenta ante una clave rechazada ni una cuota agotada (4xx)', async () => {
    for (const status of [400, 403, 429]) {
      clearCatalogCache();
      let calls = 0;
      const ctx = router(async () => response({}), async () => (++calls, response({}, { status })));
      assert.deepEqual(await findBookByIsbn(ctx, ISBN), { book: null });
      assert.equal(calls, 1);
    }
  });

  it('si Open Library falla y Google Books tampoco lo encuentra, informa del error de Open Library', async () => {
    await rejectsWith(
      findBookByIsbn(router(async () => response({}, { status: 503 }), async () => response({ totalItems: 0 })), ISBN),
      502,
      'CATALOG_UNAVAILABLE',
    );
    await rejectsWith(
      findBookByIsbn(router(async () => response({}, { status: 429 }), async () => response({}, { status: 503 })), ISBN),
      429,
      'CATALOG_RATE_LIMITED',
    );
  });

  it('un fallo del respaldo nunca convierte «no encontrado» en un error', async () => {
    const down = router(async () => response({}), async () => {
      throw new TypeError('fetch failed');
    });
    assert.deepEqual(await findBookByIsbn(down, ISBN), { book: null });

    clearCatalogCache();
    const notJson = router(
      async () => response({}),
      async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('x'); } }) as unknown as Response,
    );
    assert.deepEqual(await findBookByIsbn(notJson, ISBN), { book: null });
  });

  it('sin clave no se consulta Google Books', async () => {
    const ctx = router(async () => response({}), async () => response(googlePayload(volume())), { googleBooksKey: '' });
    assert.deepEqual(await findBookByIsbn(ctx, ISBN), { book: null });
    assert.equal(ctx.calls.length, 1);
  });

  it('no envía a Google ninguna cabecera de la app Android: la clave es del servidor', async () => {
    const ctx = router(async () => response({}), async () => response(googlePayload(volume())));
    await findBookByIsbn(ctx, ISBN);
    const headers = googleCalls(ctx)[0].init?.headers as Record<string, string>;
    assert.equal(headers['X-Android-Package'], undefined);
    assert.equal(headers['X-Android-Cert'], undefined);
  });
});
