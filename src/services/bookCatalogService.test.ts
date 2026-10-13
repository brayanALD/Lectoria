import { CATALOG_RATE_LIMITED, CATALOG_UNAVAILABLE, findBookByIsbn, parseOpenLibraryResponse } from './bookCatalogService';

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
    const book = await findBookByIsbn(ISBN, { fetchFn });

    expect(book?.title).toBe('Slow reading');
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe(`https://openlibrary.org/api/books?bibkeys=ISBN:${ISBN}&jscmd=data&format=json`);
    expect(init.headers['User-Agent']).toMatch(/^Lectoria/);
  });

  it('devuelve null si el ISBN no está en el catálogo', async () => {
    const fetchFn = jest.fn().mockResolvedValue(response({}));
    await expect(findBookByIsbn(ISBN, { fetchFn })).resolves.toBeNull();
  });

  it('lanza «demasiadas consultas» ante un 429', async () => {
    const fetchFn = jest.fn().mockResolvedValue(response({}, { status: 429 }));
    await expect(findBookByIsbn(ISBN, { fetchFn })).rejects.toMatchObject({ code: CATALOG_RATE_LIMITED });
  });

  it('lanza «no disponible» ante un error del servidor', async () => {
    const fetchFn = jest.fn().mockResolvedValue(response({}, { status: 503 }));
    await expect(findBookByIsbn(ISBN, { fetchFn })).rejects.toMatchObject({ code: CATALOG_UNAVAILABLE });
  });

  it('lanza «no disponible» si no hay red', async () => {
    const fetchFn = jest.fn().mockRejectedValue(new TypeError('Network request failed'));
    await expect(findBookByIsbn(ISBN, { fetchFn })).rejects.toMatchObject({ code: CATALOG_UNAVAILABLE });
  });

  it('lanza «no disponible» si la respuesta no es JSON', async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('Unexpected token <');
      },
    });
    await expect(findBookByIsbn(ISBN, { fetchFn })).rejects.toMatchObject({ code: CATALOG_UNAVAILABLE });
  });

  it('cancela la petición y lanza «no disponible» si se agota el tiempo', async () => {
    const fetchFn = jest.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }),
    );
    await expect(findBookByIsbn(ISBN, { fetchFn: fetchFn as unknown as typeof fetch, timeoutMs: 20 })).rejects.toMatchObject({
      code: CATALOG_UNAVAILABLE,
    });
  });
});
