import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import { BASE_NOW, createBook, createProfile, readDoc, startEnv, type Client, type TestEnv } from './env';

let env: TestEnv;
let ana: Client;
let luis: Client;
before(async () => {
  env = await startEnv();
});
after(async () => {
  await env.close();
});
beforeEach(async () => {
  await env.clear();
  ana = env.client('ana');
  luis = env.client('luis');
  await createProfile(ana);
  await createProfile(luis);
});

const book = (id: string, uid = 'ana') => readDoc(env.db, `users/${uid}/books/${id}`);

describe('crear libros', () => {
  it('crea el libro con fechas del servidor y valores por defecto', async () => {
    const res = await ana.post('/v1/books', { title: '  Dune  ', authors: ['Frank Herbert', 'frank herbert'] });
    assert.equal(res.status, 201);
    const saved = await book(res.body.id);
    assert.equal(saved?.title, 'Dune');
    assert.deepEqual(saved?.authors, ['Frank Herbert']);
    assert.equal(saved?.status, 'want_to_read');
    assert.equal(saved?.acquisition, 'owned');
    assert.equal(saved?.currentPage, 0);
    assert.ok(saved?.createdAt && saved?.updatedAt);
    assert.equal(saved?.startedAt, undefined);
  });

  it('un libro terminado queda en la última página con fechas de inicio y fin', async () => {
    const id = await createBook(ana, { status: 'finished', pageCount: 300 });
    const saved = await book(id);
    assert.equal(saved?.currentPage, 300);
    assert.ok(saved?.startedAt && saved?.finishedAt);
  });

  it('un libro «leyendo» fija solo la fecha de inicio', async () => {
    const saved = await book(await createBook(ana, { status: 'reading' }));
    assert.ok(saved?.startedAt);
    assert.equal(saved?.finishedAt, undefined);
  });

  it('un deseo entra como «Quiero leerlo», en la página 0 y sin datos de compra', async () => {
    const saved = await book(await createBook(ana, { acquisition: 'wishlist', status: 'finished' }));
    assert.equal(saved?.acquisition, 'wishlist');
    assert.equal(saved?.status, 'want_to_read');
    assert.equal(saved?.currentPage, 0);
    assert.equal(saved?.price, undefined);
    assert.equal(saved?.purchasedAt, undefined);
  });

  it('guarda el ISBN normalizado a ISBN-13 y solo acepta portadas https', async () => {
    const con = await book(await createBook(ana, { isbn13: '0-306-40615-2', coverUrl: 'https://x.test/c.jpg' }));
    assert.equal(con?.isbn13, '9780306406157');
    assert.equal(con?.coverUrl, 'https://x.test/c.jpg');
    const sin = await book(await createBook(ana, { coverUrl: 'http://x.test/c.jpg' }));
    assert.equal(sin?.coverUrl, undefined);
  });

  it('valida los campos y devuelve todos los errores a la vez', async () => {
    const res = await ana.post('/v1/books', {
      title: '   ',
      authors: [],
      pageCount: 0,
      seriesOrder: 3,
      status: 'volando',
      isbn13: '123',
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'VALIDATION');
    const campos = Object.keys(res.body.error.fields).sort();
    assert.deepEqual(campos, ['authors', 'isbn13', 'pageCount', 'seriesOrder', 'status', 'title']);
  });

  it('respeta los límites de títulos, autores, géneros y páginas', async () => {
    for (const body of [
      { title: 'x'.repeat(301), authors: ['a'] },
      { title: 't', authors: Array.from({ length: 21 }, (_, i) => `autor ${i}`) },
      { title: 't', authors: ['a'.repeat(121)] },
      { title: 't', authors: ['a'], genres: Array.from({ length: 21 }, (_, i) => `g${i}`) },
      { title: 't', authors: ['a'], pageCount: 100001 },
      { title: 't', authors: ['a'], pageCount: 1.5 },
      { title: 't', authors: 'a, b' },
      { title: 5, authors: ['a'] },
    ]) {
      assert.equal((await ana.post('/v1/books', body)).status, 400, JSON.stringify(body).slice(0, 80));
    }
    const justo = await ana.post('/v1/books', { title: 'x'.repeat(300), authors: ['a'], pageCount: 100000 });
    assert.equal(justo.status, 201);
  });

  it('con requestId, repetir la creación no duplica el libro', async () => {
    const body = { requestId: 'libro-0001-abc', title: 'Dune', authors: ['Frank Herbert'] };
    const first = await ana.post('/v1/books', body);
    const second = await ana.post('/v1/books', body);
    assert.equal(first.status, 201);
    assert.equal(second.status, 200);
    assert.equal(second.body.repeated, true);
    assert.equal(second.body.id, first.body.id);
    assert.equal((await env.db.collection('users/ana/books').get()).size, 1);
  });

  it('rechaza un requestId con formato inválido', async () => {
    const res = await ana.post('/v1/books', { requestId: 'a/b', title: 'x', authors: ['y'] });
    assert.equal(res.status, 400);
    assert.ok(res.body.error.fields.requestId);
  });

  it('cada persona crea solo en su biblioteca (el uid sale del token)', async () => {
    const id = await createBook(luis);
    assert.ok(await book(id, 'luis'));
    assert.equal(await book(id, 'ana'), undefined);
  });
});

describe('editar libros', () => {
  it('actualiza los datos y elimina los opcionales que se vaciaron', async () => {
    const id = await createBook(ana, { genres: ['Ficción'], seriesName: 'Dune', seriesOrder: 1, isbn13: '9780306406157', coverUrl: 'https://x.test/c.jpg' });
    const res = await ana.patch(`/v1/books/${id}`, { title: 'Dune Messiah', authors: ['Frank Herbert'] });
    assert.equal(res.status, 204);
    const saved = await book(id);
    assert.equal(saved?.title, 'Dune Messiah');
    for (const campo of ['genres', 'seriesName', 'seriesOrder', 'pageCount', 'isbn13', 'coverUrl']) {
      assert.equal(saved?.[campo], undefined, campo);
    }
  });

  it('no cambia el estado, la adquisición ni el progreso', async () => {
    const id = await createBook(ana, { status: 'reading', pageCount: 400 });
    await ana.post('/v1/sessions', { bookId: id, date: BASE_NOW.toISOString(), timeZone: 'America/Bogota', endPage: 120, startPage: 0 });
    await ana.patch(`/v1/books/${id}`, { title: 'Otro título', authors: ['A'], pageCount: 400, status: 'finished', acquisition: 'wishlist' });
    const saved = await book(id);
    assert.equal(saved?.status, 'reading');
    assert.equal(saved?.acquisition, 'owned');
    assert.equal(saved?.currentPage, 120);
  });

  it('recorta el progreso si el nuevo total es menor, y un libro terminado queda en la última página', async () => {
    const leyendo = await createBook(ana, { status: 'reading', pageCount: 400 });
    await ana.post('/v1/books/' + leyendo + '/progress', { page: 300, timeZone: 'America/Bogota' });
    await ana.patch(`/v1/books/${leyendo}`, { title: 'Dune', authors: ['A'], pageCount: 200 });
    assert.equal((await book(leyendo))?.currentPage, 200);

    const terminado = await createBook(ana, { status: 'finished', pageCount: 300 });
    await ana.patch(`/v1/books/${terminado}`, { title: 'Dune', authors: ['A'], pageCount: 350 });
    assert.equal((await book(terminado))?.currentPage, 350);
  });

  it('un libro que no existe responde 404 y no se crea', async () => {
    const res = await ana.patch('/v1/books/fantasma', { title: 'x', authors: ['y'] });
    assert.equal(res.status, 404);
    assert.equal(await book('fantasma'), undefined);
  });

  it('nadie puede editar el libro de otra persona', async () => {
    const id = await createBook(ana);
    const res = await luis.patch(`/v1/books/${id}`, { title: 'Hackeado', authors: ['x'] });
    assert.equal(res.status, 404);
    assert.equal((await book(id))?.title, 'Dune');
  });
});

describe('estado de lectura', () => {
  it('empezar a leer fija la fecha de inicio', async () => {
    const id = await createBook(ana);
    assert.equal((await ana.put(`/v1/books/${id}/status`, { status: 'reading' })).status, 204);
    const saved = await book(id);
    assert.equal(saved?.status, 'reading');
    assert.ok(saved?.startedAt);
  });

  it('reabrir un libro terminado borra la fecha de fin y conserva el progreso', async () => {
    const id = await createBook(ana, { status: 'finished', pageCount: 300 });
    await ana.put(`/v1/books/${id}/status`, { status: 'reading' });
    const saved = await book(id);
    assert.equal(saved?.status, 'reading');
    assert.equal(saved?.finishedAt, undefined);
    assert.equal(saved?.currentPage, 300);
  });

  it('no escribe nada si el estado no cambia', async () => {
    const id = await createBook(ana, { status: 'reading' });
    const before = (await book(id))?.updatedAt;
    await ana.put(`/v1/books/${id}/status`, { status: 'reading' });
    assert.deepEqual((await book(id))?.updatedAt, before);
  });

  it('«Terminado» no se admite por aquí: se usa finish', async () => {
    const id = await createBook(ana);
    const res = await ana.put(`/v1/books/${id}/status`, { status: 'finished' });
    assert.equal(res.status, 400);
    assert.ok(res.body.error.fields.status);
    assert.equal((await book(id))?.status, 'want_to_read');
  });

  it('rechaza un estado desconocido y nadie cambia el estado de un libro ajeno', async () => {
    const id = await createBook(ana);
    assert.equal((await ana.put(`/v1/books/${id}/status`, { status: 'dormido' })).status, 400);
    assert.equal((await luis.put(`/v1/books/${id}/status`, { status: 'reading' })).status, 404);
    assert.equal((await book(id))?.status, 'want_to_read');
  });
});

describe('notas y reseña', () => {
  it('guardar las notas no toca la reseña, ni el estado, ni el progreso', async () => {
    const id = await createBook(ana, { status: 'reading' });
    await ana.put(`/v1/books/${id}/review`, { rating: 4.5, review: 'Muy bueno' });
    await ana.put(`/v1/books/${id}/notes`, { notes: '  Recordar el capítulo 3  ' });
    const saved = await book(id);
    assert.equal(saved?.notes, 'Recordar el capítulo 3');
    assert.equal(saved?.rating, 4.5);
    assert.equal(saved?.review, 'Muy bueno');
    assert.equal(saved?.status, 'reading');
  });

  it('sin texto, las notas se eliminan; y no pasan de 10 000 caracteres', async () => {
    const id = await createBook(ana);
    await ana.put(`/v1/books/${id}/notes`, { notes: 'algo' });
    await ana.put(`/v1/books/${id}/notes`, { notes: '   ' });
    assert.equal((await book(id))?.notes, undefined);
    assert.equal((await ana.put(`/v1/books/${id}/notes`, { notes: 'x'.repeat(10001) })).status, 400);
  });

  it('guardar la reseña no toca las notas y la guardada es exactamente la enviada', async () => {
    const id = await createBook(ana);
    await ana.put(`/v1/books/${id}/notes`, { notes: 'mis notas' });
    await ana.put(`/v1/books/${id}/review`, {
      rating: 3.5,
      review: 'Opinión',
      specificReviews: [{ topic: ' Personajes ', text: 'Profundos' }],
    });
    let saved = await book(id);
    assert.equal(saved?.notes, 'mis notas');
    assert.deepEqual(saved?.specificReviews, [{ topic: 'Personajes', text: 'Profundos' }]);

    await ana.put(`/v1/books/${id}/review`, { rating: 5 });
    saved = await book(id);
    assert.equal(saved?.rating, 5);
    assert.equal(saved?.review, undefined);
    assert.equal(saved?.specificReviews, undefined);
    assert.equal(saved?.notes, 'mis notas');

    await ana.put(`/v1/books/${id}/review`, {});
    saved = await book(id);
    assert.equal(saved?.rating, undefined);
  });

  it('rechaza calificaciones que no son de media en media y reseñas por tema mal formadas', async () => {
    const id = await createBook(ana);
    for (const body of [
      { rating: 4.3 },
      { rating: 0.2 },
      { rating: 6 },
      { specificReviews: [{ topic: '', text: 'x' }] },
      { specificReviews: [{ topic: 'Trama', text: '' }] },
      { specificReviews: [{ topic: 'Trama', text: 'a' }, { topic: 'TRAMA', text: 'b' }] },
      { specificReviews: Array.from({ length: 6 }, (_, i) => ({ topic: `t${i}`, text: 'x' })) },
      { specificReviews: 'no es lista' },
    ]) {
      assert.equal((await ana.put(`/v1/books/${id}/review`, body)).status, 400, JSON.stringify(body).slice(0, 70));
    }
    assert.equal((await book(id))?.rating, undefined);
  });

  it('admite 5 reseñas por tema', async () => {
    const id = await createBook(ana);
    const specificReviews = Array.from({ length: 5 }, (_, i) => ({ topic: `Tema ${i}`, text: 'x' }));
    assert.equal((await ana.put(`/v1/books/${id}/review`, { specificReviews })).status, 204);
    assert.equal((await book(id))?.specificReviews?.length, 5);
  });

  it('nadie escribe las notas ni la reseña del libro de otra persona', async () => {
    const id = await createBook(ana);
    assert.equal((await luis.put(`/v1/books/${id}/notes`, { notes: 'x' })).status, 404);
    assert.equal((await luis.put(`/v1/books/${id}/review`, { rating: 1 })).status, 404);
  });
});

describe('lista de deseos y compra', () => {
  it('comprar lo pasa a la biblioteca en el mismo documento, con fecha y precio, sin empezarlo', async () => {
    const id = await createBook(ana, { acquisition: 'wishlist' });
    const res = await ana.put(`/v1/books/${id}/purchase`, { purchasedAt: '2026-10-10T17:00:00.000Z', price: 45000.456 });
    assert.equal(res.status, 204);
    const saved = await book(id);
    assert.equal(saved?.acquisition, 'owned');
    assert.equal(saved?.status, 'want_to_read');
    assert.equal(saved?.price, 45000.46);
    assert.equal(saved?.purchasedAt.toDate().toISOString(), '2026-10-10T17:00:00.000Z');
    assert.equal((await env.db.collection('users/ana/books').get()).size, 1);
  });

  it('comprar sin precio guarda solo la fecha, y corregir sin precio lo borra', async () => {
    const id = await createBook(ana, { acquisition: 'wishlist' });
    await ana.put(`/v1/books/${id}/purchase`, { purchasedAt: '2026-10-10T17:00:00.000Z', price: 10 });
    await ana.put(`/v1/books/${id}/purchase`, { purchasedAt: '2026-10-11T17:00:00.000Z' });
    const saved = await book(id);
    assert.equal(saved?.price, undefined);
    assert.equal(saved?.purchasedAt.toDate().toISOString(), '2026-10-11T17:00:00.000Z');
  });

  it('rechaza precios inválidos, fechas futuras o ausentes y no escribe nada', async () => {
    const id = await createBook(ana, { acquisition: 'wishlist' });
    for (const body of [
      { purchasedAt: BASE_NOW.toISOString(), price: -1 },
      { purchasedAt: BASE_NOW.toISOString(), price: 1_000_000_000 },
      { purchasedAt: BASE_NOW.toISOString(), price: '45' },
      { purchasedAt: '2026-12-01T00:00:00.000Z' },
      { purchasedAt: 'ayer' },
      {},
    ]) {
      assert.equal((await ana.put(`/v1/books/${id}/purchase`, body)).status, 400, JSON.stringify(body));
    }
    assert.equal((await book(id))?.acquisition, 'wishlist');
  });

  it('nadie compra el deseo de otra persona', async () => {
    const id = await createBook(ana, { acquisition: 'wishlist' });
    assert.equal((await luis.put(`/v1/books/${id}/purchase`, { purchasedAt: BASE_NOW.toISOString() })).status, 404);
    assert.equal((await book(id))?.acquisition, 'wishlist');
  });
});

describe('eliminar libros', () => {
  it('elimina el libro y todas sus sesiones, y solo las suyas', async () => {
    const a = await createBook(ana, { status: 'reading' });
    const b = await createBook(ana, { status: 'reading' });
    for (const bookId of [a, a, b]) {
      await ana.post('/v1/sessions', { bookId, date: BASE_NOW.toISOString(), timeZone: 'America/Bogota', durationMinutes: 10 });
    }
    const res = await ana.delete(`/v1/books/${a}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.deletedSessions, 2);
    assert.equal(await book(a), undefined);
    const rest = await env.db.collection('users/ana/sessions').get();
    assert.equal(rest.size, 1);
    assert.equal(rest.docs[0].data().bookId, b);
  });

  it('elimina más sesiones de las que caben en un lote (450)', async () => {
    const id = await createBook(ana, { status: 'reading' });
    const writer = env.db.bulkWriter();
    for (let i = 0; i < 450; i++) {
      void writer.set(env.db.collection('users/ana/sessions').doc(), {
        bookId: id,
        dateKey: '2026-10-13',
        pagesRead: 0,
        durationMinutes: 5,
      });
    }
    await writer.close();
    const res = await ana.delete(`/v1/books/${id}`);
    assert.equal(res.body.deletedSessions, 450);
    assert.equal((await env.db.collection('users/ana/sessions').get()).size, 0);
  });

  it('es idempotente: borrar un libro que ya no existe no es un error', async () => {
    const res = await ana.delete('/v1/books/ya-no-esta');
    assert.equal(res.status, 200);
    assert.equal(res.body.deletedSessions, 0);
  });

  it('nadie elimina los libros ni las sesiones de otra persona', async () => {
    const id = await createBook(ana, { status: 'reading' });
    await ana.post('/v1/sessions', { bookId: id, date: BASE_NOW.toISOString(), timeZone: 'America/Bogota', durationMinutes: 10 });
    await luis.delete(`/v1/books/${id}`);
    assert.ok(await book(id));
    assert.equal((await env.db.collection('users/ana/sessions').get()).size, 1);
  });
});
