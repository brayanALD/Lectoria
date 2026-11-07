import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import { clearCatalogCache, parseGoogleBooksResponse, parseOpenLibraryResponse } from '../../src/services/catalog';
import { startEnv, type TestEnv } from './env';

let env: TestEnv;
before(async () => {
  env = await startEnv();
});
after(async () => {
  await env.close();
});
beforeEach(() => {
  clearCatalogCache();
  env.setConfig({ googleBooksKey: '', openLibraryContact: '' });
});

const ISBN = '9780306406157';

const openLibrary = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

const dune = {
  [`ISBN:${ISBN}`]: {
    title: 'Dune',
    subtitle: 'edición especial',
    authors: [{ name: 'Frank Herbert' }],
    number_of_pages: 612,
    cover: { medium: 'https://covers.test/dune.jpg' },
  },
};

describe('GET /v1/catalog/isbn/:isbn', () => {
  it('encuentra el libro en Open Library y devuelve lo que sirve para el formulario', async () => {
    const urls: string[] = [];
    env.setFetch(async (url, init) => {
      urls.push(String(url));
      assert.equal((init?.headers as Record<string, string>)['User-Agent'], 'Lectoria');
      return openLibrary(dune);
    });
    const res = await env.client('ana').get(`/v1/catalog/isbn/${ISBN}`);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, {
      book: { isbn13: ISBN, title: 'Dune: edición especial', authors: ['Frank Herbert'], pageCount: 612, coverUrl: 'https://covers.test/dune.jpg' },
    });
    assert.match(urls[0], /openlibrary\.org\/api\/books\?bibkeys=ISBN:9780306406157/);
  });

  it('acepta un ISBN-10 con guiones y lo busca como ISBN-13', async () => {
    let asked = '';
    env.setFetch(async (url) => {
      asked = String(url);
      return openLibrary(dune);
    });
    const res = await env.client('ana').get('/v1/catalog/isbn/0-306-40615-2');
    assert.equal(res.status, 200);
    assert.ok(asked.includes(ISBN));
  });

  it('identifica la app con el contacto configurado', async () => {
    env.setConfig({ openLibraryContact: 'contacto@correo.test' });
    env.setFetch(async (_url, init) => {
      assert.equal((init?.headers as Record<string, string>)['User-Agent'], 'Lectoria (contacto@correo.test)');
      return openLibrary(dune);
    });
    assert.equal((await env.client('ana').get(`/v1/catalog/isbn/${ISBN}`)).status, 200);
  });

  it('rechaza un ISBN inválido sin consultar ningún catálogo', async () => {
    env.setFetch(async () => {
      throw new Error('no debía consultarse');
    });
    for (const isbn of ['123', '9780306406158', 'abcdefghij']) {
      const res = await env.client('ana').get(`/v1/catalog/isbn/${isbn}`);
      assert.equal(res.status, 400, isbn);
      assert.ok(res.body.error.fields.isbn);
    }
  });

  it('si ningún catálogo lo conoce responde book: null', async () => {
    env.setFetch(async () => openLibrary({}));
    const res = await env.client('ana').get(`/v1/catalog/isbn/${ISBN}`);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { book: null });
  });

  it('recuerda los resultados: la segunda consulta no sale a Internet', async () => {
    let calls = 0;
    env.setFetch(async () => {
      calls += 1;
      return openLibrary(dune);
    });
    await env.client('ana').get(`/v1/catalog/isbn/${ISBN}`);
    const again = await env.client('luis').get(`/v1/catalog/isbn/${ISBN}`);
    assert.equal(calls, 1);
    assert.equal(again.body.book.title, 'Dune: edición especial');
  });

  it('un fallo del catálogo no se recuerda: responde 502 y la siguiente consulta lo vuelve a intentar', async () => {
    let calls = 0;
    env.setFetch(async () => {
      calls += 1;
      return calls === 1 ? openLibrary({}, 503) : openLibrary(dune);
    });
    const fallo = await env.client('ana').get(`/v1/catalog/isbn/${ISBN}`);
    assert.equal(fallo.status, 502);
    assert.equal(fallo.body.error.code, 'CATALOG_UNAVAILABLE');
    assert.equal((await env.client('ana').get(`/v1/catalog/isbn/${ISBN}`)).status, 200);
  });

  it('sin red responde 502, y con demasiadas consultas (429) lo traslada', async () => {
    env.setFetch(async () => {
      throw new TypeError('fetch failed');
    });
    assert.equal((await env.client('ana').get(`/v1/catalog/isbn/${ISBN}`)).status, 502);

    env.setFetch(async () => openLibrary({}, 429));
    const limited = await env.client('ana').get(`/v1/catalog/isbn/${ISBN}`);
    assert.equal(limited.status, 429);
    assert.equal(limited.body.error.code, 'CATALOG_RATE_LIMITED');
  });

  it('usa Google Books como respaldo solo si hay clave y Open Library no lo conoce', async () => {
    const google = { items: [{ volumeInfo: { title: 'Dune', authors: ['Frank Herbert'], pageCount: 500, industryIdentifiers: [{ type: 'ISBN_13', identifier: ISBN }], imageLinks: { thumbnail: 'http://books.test/c?id=1&edge=curl' } } }] };
    const urls: string[] = [];
    env.setFetch(async (url) => {
      urls.push(String(url));
      return String(url).includes('openlibrary') ? openLibrary({}) : openLibrary(google);
    });

    // Sin clave: no se consulta Google.
    assert.deepEqual((await env.client('ana').get(`/v1/catalog/isbn/${ISBN}`)).body, { book: null });
    assert.equal(urls.filter((u) => u.includes('googleapis')).length, 0);

    clearCatalogCache();
    env.setConfig({ googleBooksKey: 'clave-secreta' });
    const res = await env.client('ana').get(`/v1/catalog/isbn/${ISBN}`);
    assert.equal(res.body.book.pageCount, 500);
    assert.equal(res.body.book.coverUrl, 'https://books.test/c?id=1');
    const googleUrl = urls.find((u) => u.includes('googleapis')) as string;
    assert.ok(googleUrl.includes('key=clave-secreta'));
  });

  it('si Open Library falla y Google no lo encuentra, se informa del fallo de Open Library', async () => {
    env.setConfig({ googleBooksKey: 'k' });
    env.setFetch(async (url) => (String(url).includes('openlibrary') ? openLibrary({}, 500) : openLibrary({ items: [] })));
    assert.equal((await env.client('ana').get(`/v1/catalog/isbn/${ISBN}`)).status, 502);
  });

  it('requiere sesión', async () => {
    assert.equal((await env.raw('GET', `/v1/catalog/isbn/${ISBN}`)).status, 401);
  });
});

describe('interpretación de las respuestas', () => {
  it('Open Library: sin título no hay libro, y descarta lo que está fuera de límites', () => {
    assert.equal(parseOpenLibraryResponse({ [`ISBN:${ISBN}`]: { authors: [{ name: 'X' }] } }, ISBN), null);
    assert.equal(parseOpenLibraryResponse(null, ISBN), null);
    const book = parseOpenLibraryResponse(
      { [`ISBN:${ISBN}`]: { title: 'T', authors: [{ name: 'a'.repeat(121) }, { name: 'Bien' }], number_of_pages: 0, cover: { small: 'http://x/c.jpg' } } },
      ISBN,
    );
    assert.deepEqual(book, { isbn13: ISBN, title: 'T', authors: ['Bien'] });
  });

  it('Google Books: solo acepta el volumen que declara ese ISBN-13', () => {
    const item = (isbn: string) => ({ volumeInfo: { title: 'X', industryIdentifiers: [{ type: 'ISBN_13', identifier: isbn }] } });
    assert.equal(parseGoogleBooksResponse({ items: [item('9781111111111')] }, ISBN), null);
    assert.equal(parseGoogleBooksResponse({ items: [item('9781111111111'), item(ISBN)] }, ISBN)?.title, 'X');
    assert.equal(parseGoogleBooksResponse({}, ISBN), null);
  });
});
