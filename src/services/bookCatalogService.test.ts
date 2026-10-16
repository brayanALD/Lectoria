import {
  CATALOG_RATE_LIMITED,
  CATALOG_UNAVAILABLE,
  findBookByIsbn,
  getGoogleBooksHeaders,
  parseGoogleBooksResponse,
  parseOpenLibraryResponse,
} from './bookCatalogService';

const ISBN = '9780980200447';

// Las pruebas de Open Library no deben depender de que haya una clave de Google Books en el entorno.
const NO_FALLBACK = { googleBooksKey: null } as const;

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

describe('parseOpenLibraryResponse', () => {
  it('extrae título, autores, páginas y la portada mediana', () => {
    expect(parseOpenLibraryResponse(payload(), ISBN)).toEqual({
      isbn13: ISBN,
      title: 'Slow reading',
      authors: ['John Miedema'],
      pageCount: 80,
      coverUrl: 'https://covers.openlibrary.org/b/id/5546156-M.jpg',
    });
  });

  it('añade el subtítulo al título', () => {
    const book = parseOpenLibraryResponse(payload({ subtitle: 'una guía' }), ISBN);
    expect(book?.title).toBe('Slow reading: una guía');
  });

  it('devuelve null cuando el catálogo no conoce el ISBN (respuesta vacía)', () => {
    expect(parseOpenLibraryResponse({}, ISBN)).toBeNull();
  });

  it('devuelve null con respuestas que no tienen la forma esperada', () => {
    expect(parseOpenLibraryResponse(null, ISBN)).toBeNull();
    expect(parseOpenLibraryResponse('texto', ISBN)).toBeNull();
    expect(parseOpenLibraryResponse([], ISBN)).toBeNull();
    expect(parseOpenLibraryResponse({ [`ISBN:${ISBN}`]: 5 }, ISBN)).toBeNull();
  });

  it('devuelve null si no hay título utilizable', () => {
    expect(parseOpenLibraryResponse(payload({ title: '   ' }), ISBN)).toBeNull();
    expect(parseOpenLibraryResponse(payload({ title: 42 }), ISBN)).toBeNull();
  });

  it('acepta un libro sin autores, páginas ni portada, y no incluye claves vacías', () => {
    const book = parseOpenLibraryResponse(
      { [`ISBN:${ISBN}`]: { title: 'Solo título' } },
      ISBN,
    );
    expect(book).toEqual({ isbn13: ISBN, title: 'Solo título', authors: [] });
    expect(Object.keys(book!)).toEqual(['isbn13', 'title', 'authors']);
  });

  it('descarta páginas fuera de rango o no enteras, en lugar de fallar', () => {
    for (const pages of [0, -5, 1.5, 'cien', 10_000_000, null]) {
      expect(parseOpenLibraryResponse(payload({ number_of_pages: pages }), ISBN)?.pageCount).toBeUndefined();
    }
  });

  it('ignora autores sin nombre y limita el número de autores', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ name: `Autor ${i}` }));
    const book = parseOpenLibraryResponse(payload({ authors: [{ url: 'x' }, { name: '  ' }, ...many] }), ISBN);
    expect(book?.authors).toHaveLength(20);
    expect(book?.authors[0]).toBe('Autor 0');
  });

  it('solo acepta portadas https; si la mediana no sirve usa otra', () => {
    const fromLarge = parseOpenLibraryResponse(
      payload({ cover: { medium: 'http://inseguro/m.jpg', large: 'https://covers.openlibrary.org/l.jpg' } }),
      ISBN,
    );
    expect(fromLarge?.coverUrl).toBe('https://covers.openlibrary.org/l.jpg');
    expect(parseOpenLibraryResponse(payload({ cover: { medium: 'http://inseguro/m.jpg' } }), ISBN)?.coverUrl).toBeUndefined();
  });

  it('recorta un título demasiado largo al límite que aceptan las reglas', () => {
    expect(parseOpenLibraryResponse(payload({ title: 'a'.repeat(500) }), ISBN)?.title).toHaveLength(300);
  });
});

describe('findBookByIsbn', () => {
  it('consulta el endpoint con el ISBN, formato JSON y datos completos', async () => {
    const fetchFn = jest.fn().mockResolvedValue(response(payload()));
    const book = await findBookByIsbn(ISBN, { ...NO_FALLBACK, fetchFn });

    expect(book?.title).toBe('Slow reading');
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe(`https://openlibrary.org/api/books?bibkeys=ISBN:${ISBN}&jscmd=data&format=json`);
    expect(init.headers['User-Agent']).toMatch(/^Lectoria/);
  });

  it('devuelve null si el ISBN no está en el catálogo', async () => {
    const fetchFn = jest.fn().mockResolvedValue(response({}));
    await expect(findBookByIsbn(ISBN, { ...NO_FALLBACK, fetchFn })).resolves.toBeNull();
  });

  it('lanza «demasiadas consultas» ante un 429', async () => {
    const fetchFn = jest.fn().mockResolvedValue(response({}, { status: 429 }));
    await expect(findBookByIsbn(ISBN, { ...NO_FALLBACK, fetchFn })).rejects.toMatchObject({ code: CATALOG_RATE_LIMITED });
  });

  it('lanza «no disponible» ante un error del servidor', async () => {
    const fetchFn = jest.fn().mockResolvedValue(response({}, { status: 503 }));
    await expect(findBookByIsbn(ISBN, { ...NO_FALLBACK, fetchFn })).rejects.toMatchObject({ code: CATALOG_UNAVAILABLE });
  });

  it('lanza «no disponible» si no hay red', async () => {
    const fetchFn = jest.fn().mockRejectedValue(new TypeError('Network request failed'));
    await expect(findBookByIsbn(ISBN, { ...NO_FALLBACK, fetchFn })).rejects.toMatchObject({ code: CATALOG_UNAVAILABLE });
  });

  it('lanza «no disponible» si la respuesta no es JSON', async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('Unexpected token <');
      },
    });
    await expect(findBookByIsbn(ISBN, { ...NO_FALLBACK, fetchFn })).rejects.toMatchObject({ code: CATALOG_UNAVAILABLE });
  });

  it('cancela la petición y lanza «no disponible» si se agota el tiempo', async () => {
    const fetchFn = jest.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }),
    );
    await expect(findBookByIsbn(ISBN, { ...NO_FALLBACK, fetchFn: fetchFn as unknown as typeof fetch, timeoutMs: 20 })).rejects.toMatchObject({
      code: CATALOG_UNAVAILABLE,
    });
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
    expect(parseGoogleBooksResponse(googlePayload(volume()), ISBN)).toEqual({
      isbn13: ISBN,
      title: 'Slow reading',
      authors: ['John Miedema'],
      pageCount: 80,
      coverUrl: 'https://books.google.com/books/content?id=abc&printsec=frontcover&img=1&zoom=1&source=gbs_api',
    });
  });

  it('añade el subtítulo al título', () => {
    expect(parseGoogleBooksResponse(googlePayload(volume({ subtitle: 'una guía' })), ISBN)?.title).toBe('Slow reading: una guía');
  });

  it('devuelve null si no hay resultados o la respuesta no tiene la forma esperada', () => {
    expect(parseGoogleBooksResponse({}, ISBN)).toBeNull();
    expect(parseGoogleBooksResponse({ totalItems: 0 }, ISBN)).toBeNull();
    expect(parseGoogleBooksResponse(googlePayload(), ISBN)).toBeNull();
    expect(parseGoogleBooksResponse(null, ISBN)).toBeNull();
    expect(parseGoogleBooksResponse('texto', ISBN)).toBeNull();
    expect(parseGoogleBooksResponse({ items: 5 }, ISBN)).toBeNull();
    expect(parseGoogleBooksResponse(googlePayload(null, 7, {}), ISBN)).toBeNull();
  });

  it('descarta un volumen que no declara ese ISBN-13 (falsos positivos de la búsqueda libre)', () => {
    const other = volume({ title: 'Manual de programación' }, [{ type: 'ISBN_13', identifier: '9788466329125' }]);
    expect(parseGoogleBooksResponse(googlePayload(other), ISBN)).toBeNull();
    expect(parseGoogleBooksResponse(googlePayload(volume({}, [])), ISBN)).toBeNull();
    expect(parseGoogleBooksResponse(googlePayload(volume({}, null)), ISBN)).toBeNull();
    // Un ISBN-10 igual de parecido no sirve: tiene que ser el ISBN-13 pedido.
    expect(parseGoogleBooksResponse(googlePayload(volume({}, [{ type: 'ISBN_10', identifier: '0980200441' }])), ISBN)).toBeNull();
  });

  it('elige el volumen que coincide aunque no sea el primero', () => {
    const other = volume({ title: 'Otro libro' }, [{ type: 'ISBN_13', identifier: '9788466329125' }]);
    expect(parseGoogleBooksResponse(googlePayload(other, volume()), ISBN)?.title).toBe('Slow reading');
  });

  it('acepta un identificador con guiones', () => {
    const hyphenated = volume({}, [{ type: 'ISBN_13', identifier: '978-0-9802004-4-7' }]);
    expect(parseGoogleBooksResponse(googlePayload(hyphenated), ISBN)?.title).toBe('Slow reading');
  });

  it('devuelve null si el volumen no tiene título utilizable', () => {
    expect(parseGoogleBooksResponse(googlePayload(volume({ title: '  ' })), ISBN)).toBeNull();
    expect(parseGoogleBooksResponse(googlePayload(volume({ title: 3 })), ISBN)).toBeNull();
  });

  it('acepta un libro sin autores, páginas ni portada, y no incluye claves vacías', () => {
    const bare = { volumeInfo: { title: 'Solo título', industryIdentifiers: [{ type: 'ISBN_13', identifier: ISBN }] } };
    const book = parseGoogleBooksResponse(googlePayload(bare), ISBN);
    expect(book).toEqual({ isbn13: ISBN, title: 'Solo título', authors: [] });
    expect(book).not.toHaveProperty('pageCount');
    expect(book).not.toHaveProperty('coverUrl');
  });

  it('descarta páginas fuera de rango y usa la miniatura pequeña si la grande no sirve', () => {
    expect(parseGoogleBooksResponse(googlePayload(volume({ pageCount: 0 })), ISBN)).not.toHaveProperty('pageCount');
    expect(parseGoogleBooksResponse(googlePayload(volume({ pageCount: 12.5 })), ISBN)).not.toHaveProperty('pageCount');
    const smallOnly = volume({ imageLinks: { thumbnail: 'ftp://x', smallThumbnail: 'http://books.google.com/small' } });
    expect(parseGoogleBooksResponse(googlePayload(smallOnly), ISBN)?.coverUrl).toBe('https://books.google.com/small');
  });
});

describe('getGoogleBooksHeaders', () => {
  const SHA1 = 'aa:bb:cc:dd:ee:ff:00:11:22:33:44:55:66:77:88:99:0a:0b:0c:0d';

  it('en Android con huella envía el paquete y la huella en mayúsculas y sin separadores', () => {
    expect(getGoogleBooksHeaders('android', SHA1)).toEqual({
      'X-Android-Package': 'com.lectoria.app',
      'X-Android-Cert': 'AABBCCDDEEFF001122334455667788990A0B0C0D',
    });
  });

  it('sin huella o en otra plataforma no envía nada', () => {
    expect(getGoogleBooksHeaders('android', undefined)).toEqual({});
    expect(getGoogleBooksHeaders('android', '')).toEqual({});
    expect(getGoogleBooksHeaders('ios', SHA1)).toEqual({});
  });
});

describe('findBookByIsbn con respaldo de Google Books', () => {
  const KEY = 'clave-de-prueba';
  const olBook = payload();
  const base = { googleBooksKey: KEY, platformOs: 'ios', retryDelayMs: 0 } as const;
  const isGoogle = (url: string) => url.startsWith('https://www.googleapis.com/books/v1/volumes');

  /** `fetch` que contesta según el proveedor al que va la petición. */
  const router = (open: () => Promise<Response>, google: () => Promise<Response>) =>
    jest.fn((url: string) => (isGoogle(url) ? google() : open()));

  it('si Open Library lo encuentra, no consulta Google Books', async () => {
    const fetchFn = router(async () => response(olBook), async () => response(googlePayload(volume())));
    const book = await findBookByIsbn(ISBN, { ...base, fetchFn: fetchFn as unknown as typeof fetch });
    expect(book?.title).toBe('Slow reading');
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('si Open Library no lo conoce, lo busca en Google Books con la clave y solo con isbn:', async () => {
    const fetchFn = router(async () => response({}), async () => response(googlePayload(volume({ title: 'Del respaldo' }))));
    const book = await findBookByIsbn(ISBN, { ...base, fetchFn: fetchFn as unknown as typeof fetch });

    expect(book).toMatchObject({ isbn13: ISBN, title: 'Del respaldo', pageCount: 80 });
    const googleCall = fetchFn.mock.calls.find(([url]) => isGoogle(url));
    expect(googleCall?.[0]).toContain(`q=isbn:${ISBN}`);
    expect(googleCall?.[0]).toContain(`key=${KEY}`);
  });

  it('si Open Library falla, Google Books responde por él', async () => {
    const fetchFn = router(async () => response({}, { status: 503 }), async () => response(googlePayload(volume())));
    await expect(findBookByIsbn(ISBN, { ...base, fetchFn: fetchFn as unknown as typeof fetch })).resolves.toMatchObject({ title: 'Slow reading' });

    const limited = router(async () => response({}, { status: 429 }), async () => response(googlePayload(volume())));
    await expect(findBookByIsbn(ISBN, { ...base, fetchFn: limited as unknown as typeof fetch })).resolves.toMatchObject({ title: 'Slow reading' });
  });

  it('si ninguno lo conoce devuelve null', async () => {
    const fetchFn = router(async () => response({}), async () => response({ totalItems: 0 }));
    await expect(findBookByIsbn(ISBN, { ...base, fetchFn: fetchFn as unknown as typeof fetch })).resolves.toBeNull();
  });

  it('un volumen de Google Books con otro ISBN no cuenta: devuelve null', async () => {
    const wrong = volume({ title: 'Libro equivocado' }, [{ type: 'ISBN_13', identifier: '9788466329125' }]);
    const fetchFn = router(async () => response({}), async () => response(googlePayload(wrong)));
    await expect(findBookByIsbn(ISBN, { ...base, fetchFn: fetchFn as unknown as typeof fetch })).resolves.toBeNull();
  });

  it('reintenta una vez si Google Books responde 503 y usa la segunda respuesta', async () => {
    let calls = 0;
    const fetchFn = router(
      async () => response({}),
      async () => (++calls === 1 ? response({}, { status: 503 }) : response(googlePayload(volume()))),
    );
    await expect(findBookByIsbn(ISBN, { ...base, fetchFn: fetchFn as unknown as typeof fetch })).resolves.toMatchObject({ title: 'Slow reading' });
    expect(calls).toBe(2);
  });

  it('no reintenta más de una vez: dos 503 seguidos dejan «no encontrado»', async () => {
    let calls = 0;
    const fetchFn = router(async () => response({}), async () => (++calls, response({}, { status: 503 })));
    await expect(findBookByIsbn(ISBN, { ...base, fetchFn: fetchFn as unknown as typeof fetch })).resolves.toBeNull();
    expect(calls).toBe(2);
  });

  it('no reintenta ante una clave rechazada ni una cuota agotada (4xx)', async () => {
    for (const status of [400, 403, 429]) {
      let calls = 0;
      const fetchFn = router(async () => response({}), async () => (++calls, response({}, { status })));
      await expect(findBookByIsbn(ISBN, { ...base, fetchFn: fetchFn as unknown as typeof fetch })).resolves.toBeNull();
      expect(calls).toBe(1);
    }
  });

  it('si Open Library falla y Google Books tampoco lo encuentra, lanza el error de Open Library', async () => {
    const fetchFn = router(async () => response({}, { status: 503 }), async () => response({ totalItems: 0 }));
    await expect(findBookByIsbn(ISBN, { ...base, fetchFn: fetchFn as unknown as typeof fetch })).rejects.toMatchObject({
      code: CATALOG_UNAVAILABLE,
    });

    const limited = router(async () => response({}, { status: 429 }), async () => response({}, { status: 503 }));
    await expect(findBookByIsbn(ISBN, { ...base, fetchFn: limited as unknown as typeof fetch })).rejects.toMatchObject({
      code: CATALOG_RATE_LIMITED,
    });
  });

  it('un fallo del respaldo nunca convierte «no encontrado» en un error', async () => {
    const down = router(
      async () => response({}),
      async () => {
        throw new TypeError('Network request failed');
      },
    );
    await expect(findBookByIsbn(ISBN, { ...base, fetchFn: down as unknown as typeof fetch })).resolves.toBeNull();

    const notJson = router(async () => response({}), async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('x'); } }) as unknown as Response);
    await expect(findBookByIsbn(ISBN, { ...base, fetchFn: notJson as unknown as typeof fetch })).resolves.toBeNull();
  });

  it('sin clave no se consulta Google Books', async () => {
    for (const googleBooksKey of [null, '']) {
      const fetchFn = router(async () => response({}), async () => response(googlePayload(volume())));
      await expect(findBookByIsbn(ISBN, { fetchFn: fetchFn as unknown as typeof fetch, googleBooksKey })).resolves.toBeNull();
      expect(fetchFn).toHaveBeenCalledTimes(1);
    }
  });

  it('en Android con huella envía las cabeceras de la app; en iOS, no', async () => {
    const android = router(async () => response({}), async () => response(googlePayload(volume())));
    await findBookByIsbn(ISBN, { ...base, platformOs: 'android', androidCertSha1: 'AA:BB', fetchFn: android as unknown as typeof fetch });
    const sent = (android.mock.calls.find(([url]) => isGoogle(url)) as unknown as [string, { headers: Record<string, string> }])[1].headers;
    expect(sent).toMatchObject({ 'X-Android-Package': 'com.lectoria.app', 'X-Android-Cert': 'AABB' });

    const ios = router(async () => response({}), async () => response(googlePayload(volume())));
    await findBookByIsbn(ISBN, { ...base, platformOs: 'ios', androidCertSha1: 'AA:BB', fetchFn: ios as unknown as typeof fetch });
    const sentIos = (ios.mock.calls.find(([url]) => isGoogle(url)) as unknown as [string, { headers: Record<string, string> }])[1].headers;
    expect(sentIos).not.toHaveProperty('X-Android-Cert');
  });
});
