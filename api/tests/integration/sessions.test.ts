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

const TZ = 'America/Bogota';
const NOW = BASE_NOW.toISOString(); // 10:00 del 13 de octubre en Bogotá
const book = (id: string, uid = 'ana') => readDoc(env.db, `users/${uid}/books/${id}`);
const session = (id: string, uid = 'ana') => readDoc(env.db, `users/${uid}/sessions/${id}`);

async function read(c: Client, bookId: string, body: Record<string, unknown> = {}) {
  return c.post('/v1/sessions', { bookId, date: NOW, timeZone: TZ, ...body });
}

describe('registrar una sesión', () => {
  it('guarda la sesión con todos sus campos, el día en la zona del dispositivo y marcas del servidor', async () => {
    const id = await createBook(ana, { status: 'reading' });
    const res = await read(ana, id, { durationMinutes: 25, startPage: 0, endPage: 30, notes: ' buen capítulo ' });
    assert.equal(res.status, 201);
    const saved = await session(res.body.id);
    assert.equal(saved?.bookId, id);
    assert.equal(saved?.dateKey, '2026-10-13');
    assert.equal(saved?.pagesRead, 30);
    assert.equal(saved?.durationMinutes, 25);
    assert.equal(saved?.startPage, 0);
    assert.equal(saved?.endPage, 30);
    assert.equal(saved?.notes, 'buen capítulo');
    assert.ok(saved?.createdAt);
  });

  it('el día depende de la zona horaria de quien lee, no del servidor', async () => {
    const id = await createBook(ana, { status: 'reading' });
    // 03:00 UTC del 13: en Bogotá todavía es el 12 (22:00); en Tokio ya es el 13 (12:00).
    const bogota = await ana.post('/v1/sessions', { bookId: id, date: '2026-10-13T03:00:00.000Z', timeZone: TZ, durationMinutes: 5 });
    const tokio = await ana.post('/v1/sessions', { bookId: id, date: '2026-10-13T03:00:00.000Z', timeZone: 'Asia/Tokyo', durationMinutes: 5 });
    assert.equal((await session(bogota.body.id))?.dateKey, '2026-10-12');
    assert.equal((await session(tokio.body.id))?.dateKey, '2026-10-13');
  });

  it('actualiza la página actual del libro en la misma operación, sin retroceder nunca', async () => {
    const id = await createBook(ana, { status: 'reading' });
    await read(ana, id, { startPage: 0, endPage: 100 });
    assert.equal((await book(id))?.currentPage, 100);
    // Una lectura de un día anterior con página menor no deshace el avance.
    await read(ana, id, { date: '2026-10-10T17:00:00.000Z', startPage: 20, endPage: 60 });
    assert.equal((await book(id))?.currentPage, 100);
  });

  it('una sesión solo con minutos no cambia la página', async () => {
    const id = await createBook(ana, { status: 'reading' });
    await read(ana, id, { durationMinutes: 15 });
    assert.equal((await book(id))?.currentPage, 0);
  });

  it('un libro pendiente pasa a «Leyendo» con fecha de inicio', async () => {
    const id = await createBook(ana);
    await read(ana, id, { durationMinutes: 10 });
    const saved = await book(id);
    assert.equal(saved?.status, 'reading');
    assert.ok(saved?.startedAt);
  });

  it('al llegar a la última página el libro pasa a «Terminado» con fecha de fin', async () => {
    const id = await createBook(ana, { status: 'reading', pageCount: 100 });
    await read(ana, id, { startPage: 0, endPage: 100 });
    const saved = await book(id);
    assert.equal(saved?.status, 'finished');
    assert.equal(saved?.currentPage, 100);
    assert.ok(saved?.finishedAt);
  });

  it('con página final y sin inicial, parte de la página actual del libro', async () => {
    const id = await createBook(ana, { status: 'reading' });
    await read(ana, id, { startPage: 0, endPage: 50 });
    const res = await read(ana, id, { endPage: 80 });
    assert.equal((await session(res.body.id))?.pagesRead, 30);
    assert.equal((await session(res.body.id))?.startPage, 50);
  });

  it('una lectura de un día anterior exige la página inicial', async () => {
    const id = await createBook(ana, { status: 'reading' });
    const res = await read(ana, id, { date: '2026-10-10T17:00:00.000Z', endPage: 40 });
    assert.equal(res.status, 400);
    assert.ok(res.body.error.fields.startPage);
    assert.equal((await env.db.collection('users/ana/sessions').get()).size, 0);
  });

  it('valida minutos, páginas, fecha futura y que haya algo que registrar', async () => {
    const id = await createBook(ana, { status: 'reading', pageCount: 200 });
    const casos: [Record<string, unknown>, string][] = [
      [{}, 'general'],
      [{ durationMinutes: 1441 }, 'durationMinutes'],
      [{ durationMinutes: -1 }, 'durationMinutes'],
      [{ durationMinutes: 1.5 }, 'durationMinutes'],
      [{ endPage: 201 }, 'endPage'],
      [{ startPage: 50, endPage: 40 }, 'endPage'],
      [{ startPage: 50 }, 'endPage'],
      [{ startPage: 10, endPage: 10 }, 'general'],
      [{ date: '2026-10-20T00:00:00.000Z', durationMinutes: 5 }, 'date'],
      [{ notes: 'x'.repeat(5001), durationMinutes: 5 }, 'notes'],
    ];
    for (const [body, campo] of casos) {
      const res = await read(ana, id, body);
      assert.equal(res.status, 400, JSON.stringify(body));
      assert.ok(res.body.error.fields[campo], `${JSON.stringify(body)} → ${campo}`);
    }
    assert.equal((await env.db.collection('users/ana/sessions').get()).size, 0);
  });

  it('tolera un reloj del teléfono adelantado unos minutos', async () => {
    const id = await createBook(ana, { status: 'reading' });
    const res = await read(ana, id, { date: new Date(BASE_NOW.getTime() + 3 * 60_000).toISOString(), durationMinutes: 5 });
    assert.equal(res.status, 201);
  });

  it('exige una fecha ISO y una zona horaria válida', async () => {
    const id = await createBook(ana, { status: 'reading' });
    assert.equal((await ana.post('/v1/sessions', { bookId: id, date: '13/10/2026', timeZone: TZ, durationMinutes: 5 })).status, 400);
    assert.equal((await ana.post('/v1/sessions', { bookId: id, date: NOW, durationMinutes: 5 })).status, 400);
    assert.equal((await ana.post('/v1/sessions', { bookId: id, date: NOW, timeZone: 'Marte/Olimpo', durationMinutes: 5 })).status, 400);
  });

  it('un libro que no existe responde 404 y un deseo no se lee (409)', async () => {
    assert.equal((await read(ana, 'fantasma', { durationMinutes: 5 })).status, 404);
    const deseo = await createBook(ana, { acquisition: 'wishlist' });
    const res = await read(ana, deseo, { durationMinutes: 5 });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'BOOK_NOT_OWNED');
  });

  it('con requestId (el cronómetro) guardar dos veces no duplica la lectura ni mueve el libro otra vez', async () => {
    const id = await createBook(ana, { status: 'reading', pageCount: 500 });
    const body = { requestId: 'timer-1760000000000', durationMinutes: 20, startPage: 0, endPage: 40 };
    const first = await read(ana, id, body);
    await ana.post(`/v1/books/${id}/progress`, { page: 10, timeZone: TZ }); // el libro retrocede a mano
    const second = await read(ana, id, body);
    assert.equal(first.status, 201);
    assert.equal(second.status, 200);
    assert.equal(second.body.repeated, true);
    assert.equal(second.body.id, 'timer-1760000000000');
    assert.equal((await env.db.collection('users/ana/sessions').get()).size, 1);
    assert.equal((await book(id))?.currentPage, 10);
  });

  it('nadie registra sesiones en el libro de otra persona y no se escribe nada', async () => {
    const id = await createBook(ana, { status: 'reading' });
    const res = await read(luis, id, { durationMinutes: 5 });
    assert.equal(res.status, 404);
    assert.equal((await env.db.collection('users/luis/sessions').get()).size, 0);
    assert.equal((await env.db.collection('users/ana/sessions').get()).size, 0);
  });
});

describe('eliminar una sesión', () => {
  it('si fijaba la página, el libro vuelve a la lectura anterior', async () => {
    const id = await createBook(ana, { status: 'reading' });
    await read(ana, id, { startPage: 0, endPage: 50, date: '2026-10-11T17:00:00.000Z' });
    const ultima = await read(ana, id, { startPage: 50, endPage: 90 });
    assert.equal((await book(id))?.currentPage, 90);
    assert.equal((await ana.delete(`/v1/sessions/${ultima.body.id}`)).status, 204);
    assert.equal((await session(ultima.body.id)), undefined);
    assert.equal((await book(id))?.currentPage, 50);
  });

  it('eliminar la única sesión con páginas devuelve el libro a la página 0', async () => {
    const id = await createBook(ana, { status: 'reading' });
    const s = await read(ana, id, { startPage: 0, endPage: 40 });
    await ana.delete(`/v1/sessions/${s.body.id}`);
    assert.equal((await book(id))?.currentPage, 0);
  });

  it('una sesión que no fijaba la página, o solo con minutos, no toca el libro', async () => {
    const id = await createBook(ana, { status: 'reading' });
    const antigua = await read(ana, id, { startPage: 0, endPage: 30, date: '2026-10-11T17:00:00.000Z' });
    await read(ana, id, { startPage: 30, endPage: 70 });
    const minutos = await read(ana, id, { durationMinutes: 10 });
    const antes = (await book(id))?.updatedAt;
    await ana.delete(`/v1/sessions/${minutos.body.id}`);
    await ana.delete(`/v1/sessions/${antigua.body.id}`);
    const despues = await book(id);
    assert.equal(despues?.currentPage, 70);
    assert.deepEqual(despues?.updatedAt, antes);
  });

  it('eliminar la sesión que terminó el libro lo reabre en «Leyendo» sin fecha de fin', async () => {
    const id = await createBook(ana, { status: 'reading', pageCount: 100 });
    await read(ana, id, { startPage: 0, endPage: 60, date: '2026-10-11T17:00:00.000Z' });
    const final = await read(ana, id, { startPage: 60, endPage: 100 });
    assert.equal((await book(id))?.status, 'finished');
    await ana.delete(`/v1/sessions/${final.body.id}`);
    const saved = await book(id);
    assert.equal(saved?.status, 'reading');
    assert.equal(saved?.currentPage, 60);
    assert.equal(saved?.finishedAt, undefined);
  });

  it('solo cuentan las sesiones del mismo libro, y si el libro ya no existe solo se elimina la sesión', async () => {
    const a = await createBook(ana, { status: 'reading' });
    const b = await createBook(ana, { status: 'reading' });
    await read(ana, b, { startPage: 0, endPage: 200 });
    const sa = await read(ana, a, { startPage: 0, endPage: 30 });
    await ana.delete(`/v1/sessions/${sa.body.id}`);
    assert.equal((await book(a))?.currentPage, 0);

    const huerfana = await env.db.collection('users/ana/sessions').add({ bookId: 'borrado', dateKey: '2026-10-13', pagesRead: 5, durationMinutes: 0 });
    assert.equal((await ana.delete(`/v1/sessions/${huerfana.id}`)).status, 204);
    assert.equal(await session(huerfana.id), undefined);
  });

  it('es idempotente y nadie elimina las sesiones de otra persona', async () => {
    const id = await createBook(ana, { status: 'reading' });
    const s = await read(ana, id, { startPage: 0, endPage: 40 });
    assert.equal((await luis.delete(`/v1/sessions/${s.body.id}`)).status, 204);
    assert.ok(await session(s.body.id));
    assert.equal((await book(id))?.currentPage, 40);
    assert.equal((await ana.delete(`/v1/sessions/${s.body.id}`)).status, 204);
    assert.equal((await ana.delete(`/v1/sessions/${s.body.id}`)).status, 204);
  });
});

describe('editar una sesión', () => {
  async function started() {
    const id = await createBook(ana, { status: 'reading', pageCount: 300 });
    const anterior = await read(ana, id, { startPage: 0, endPage: 80, date: '2026-10-11T17:00:00.000Z' });
    const actual = await read(ana, id, { startPage: 80, endPage: 150 });
    return { id, anterior: anterior.body.id as string, actual: actual.body.id as string };
  }
  const edit = (id: string, body: Record<string, unknown>) =>
    ana.put(`/v1/sessions/${id}`, { date: NOW, timeZone: TZ, ...body });

  it('subir la página final de la sesión que fijaba el progreso avanza el libro', async () => {
    const { id, actual } = await started();
    assert.equal((await edit(actual, { startPage: 80, endPage: 200 })).status, 204);
    assert.equal((await book(id))?.currentPage, 200);
    assert.equal((await session(actual))?.pagesRead, 120);
  });

  it('bajar la página final retrocede el libro, pero nunca por debajo de otra sesión anterior', async () => {
    const { id, actual } = await started();
    await edit(actual, { startPage: 80, endPage: 120 });
    assert.equal((await book(id))?.currentPage, 120);
    await edit(actual, { startPage: 20, endPage: 60 });
    assert.equal((await book(id))?.currentPage, 80);
  });

  it('quitar la página final elimina esos campos y devuelve el libro a la lectura anterior', async () => {
    const { id, actual } = await started();
    await edit(actual, { durationMinutes: 30 });
    const saved = await session(actual);
    assert.equal(saved?.endPage, undefined);
    assert.equal(saved?.startPage, undefined);
    assert.equal(saved?.pagesRead, 0);
    assert.equal((await book(id))?.currentPage, 80);
  });

  it('editar solo minutos y notas no escribe el libro; vaciar las notas las elimina', async () => {
    const { id, actual } = await started();
    await edit(actual, { startPage: 80, endPage: 150, notes: 'hola' });
    const antes = (await book(id))?.updatedAt;
    await edit(actual, { startPage: 80, endPage: 150, durationMinutes: 45, notes: '' });
    assert.deepEqual((await book(id))?.updatedAt, antes);
    assert.equal((await session(actual))?.notes, undefined);
    assert.equal((await session(actual))?.durationMinutes, 45);
  });

  it('cambiar la fecha actualiza el día y conserva cuándo se creó', async () => {
    const { actual } = await started();
    const creada = (await session(actual))?.createdAt;
    await edit(actual, { date: '2026-10-09T17:00:00.000Z', startPage: 80, endPage: 150 });
    const saved = await session(actual);
    assert.equal(saved?.dateKey, '2026-10-09');
    assert.deepEqual(saved?.createdAt, creada);
  });

  it('subir hasta la última página termina el libro, y bajarla lo reabre', async () => {
    const { id, actual } = await started();
    await edit(actual, { startPage: 80, endPage: 300 });
    assert.equal((await book(id))?.status, 'finished');
    await edit(actual, { startPage: 80, endPage: 150 });
    const saved = await book(id);
    assert.equal(saved?.status, 'reading');
    assert.equal(saved?.finishedAt, undefined);
  });

  it('una sesión que no fijaba el progreso solo lo mueve si lo supera', async () => {
    const { id, anterior } = await started();
    assert.equal((await edit(anterior, { date: '2026-10-11T17:00:00.000Z', startPage: 0, endPage: 40 })).status, 204);
    assert.equal((await book(id))?.currentPage, 150);
    assert.equal((await edit(anterior, { date: '2026-10-11T17:00:00.000Z', startPage: 0, endPage: 200 })).status, 204);
    assert.equal((await book(id))?.currentPage, 200);
  });

  it('conserva el día enviado si cuadra con la fecha, y rechaza uno que no tiene nada que ver', async () => {
    const { actual } = await started();
    // 02:00 UTC del 13 es el 12 en Bogotá; la persona conservó el 13 con que se guardó.
    assert.equal((await edit(actual, { date: '2026-10-13T02:00:00.000Z', dateKey: '2026-10-13', startPage: 80, endPage: 150 })).status, 204);
    assert.equal((await session(actual))?.dateKey, '2026-10-13');
    const lejano = await edit(actual, { dateKey: '2026-09-01', startPage: 80, endPage: 150 });
    assert.equal(lejano.status, 400);
    assert.ok(lejano.body.error.fields.dateKey);
    assert.equal((await edit(actual, { dateKey: '13/10/2026', startPage: 80, endPage: 150 })).status, 400);
  });

  it('el libro de una sesión no cambia aunque se envíe otro bookId', async () => {
    const { actual } = await started();
    const otro = await createBook(ana, { status: 'reading' });
    await edit(actual, { bookId: otro, startPage: 80, endPage: 150 });
    assert.notEqual((await session(actual))?.bookId, otro);
  });

  it('rechaza datos inválidos sin tocar nada, y una sesión inexistente responde 404', async () => {
    const { id, actual } = await started();
    assert.equal((await edit(actual, { startPage: 100, endPage: 50 })).status, 400);
    assert.equal((await edit(actual, {})).status, 400);
    assert.equal((await edit(actual, { date: '2026-10-20T00:00:00.000Z', durationMinutes: 5 })).status, 400);
    assert.equal((await session(actual))?.endPage, 150);
    assert.equal((await book(id))?.currentPage, 150);
    assert.equal((await edit('fantasma', { durationMinutes: 5 })).status, 404);
  });

  it('nadie edita las sesiones de otra persona', async () => {
    const { id, actual } = await started();
    const res = await luis.put(`/v1/sessions/${actual}`, { date: NOW, timeZone: TZ, startPage: 80, endPage: 290 });
    assert.equal(res.status, 404);
    assert.equal((await session(actual))?.endPage, 150);
    assert.equal((await book(id))?.currentPage, 150);
  });
});

describe('ajustar el progreso a mano', () => {
  const progress = (id: string, page: number) => ana.post(`/v1/books/${id}/progress`, { page, timeZone: TZ });

  it('hacia delante registra una sesión de páginas sin minutos y avanza el libro', async () => {
    const id = await createBook(ana, { status: 'reading', pageCount: 300 });
    assert.equal((await progress(id, 40)).status, 204);
    const sesiones = await env.db.collection('users/ana/sessions').get();
    assert.equal(sesiones.size, 1);
    const s = sesiones.docs[0].data();
    assert.equal(s.durationMinutes, 0);
    assert.equal(s.pagesRead, 40);
    assert.equal(s.startPage, 0);
    assert.equal(s.endPage, 40);
    assert.equal(s.dateKey, '2026-10-13');
    assert.equal((await book(id))?.currentPage, 40);
  });

  it('hasta la última página termina el libro', async () => {
    const id = await createBook(ana, { status: 'reading', pageCount: 300 });
    await progress(id, 300);
    assert.equal((await book(id))?.status, 'finished');
  });

  it('hacia atrás corrige la página sin crear sesión; un libro terminado vuelve a «Leyendo»', async () => {
    const id = await createBook(ana, { status: 'reading', pageCount: 300 });
    await progress(id, 300);
    await env.db.recursiveDelete(env.db.collection('users/ana/sessions'));
    await progress(id, 120);
    const saved = await book(id);
    assert.equal(saved?.currentPage, 120);
    assert.equal(saved?.status, 'reading');
    assert.equal(saved?.finishedAt, undefined);
    assert.equal((await env.db.collection('users/ana/sessions').get()).size, 0);
  });

  it('la misma página no escribe nada, y una página fuera del libro se rechaza', async () => {
    const id = await createBook(ana, { status: 'reading', pageCount: 300 });
    await progress(id, 0);
    assert.equal((await env.db.collection('users/ana/sessions').get()).size, 0);
    assert.equal((await progress(id, 301)).status, 400);
    assert.equal((await progress(id, -1)).status, 400);
    assert.equal((await ana.post(`/v1/books/${id}/progress`, { page: 5 })).status, 400);
  });

  it('nadie ajusta el progreso de otra persona', async () => {
    const id = await createBook(ana, { status: 'reading', pageCount: 300 });
    assert.equal((await luis.post(`/v1/books/${id}/progress`, { page: 50, timeZone: TZ })).status, 404);
    assert.equal((await book(id))?.currentPage, 0);
  });
});

describe('terminar un libro', () => {
  const finish = (c: Client, id: string) => c.post(`/v1/books/${id}/finish`, { timeZone: TZ });

  it('registra las páginas que faltaban y termina el libro en la misma operación', async () => {
    const id = await createBook(ana, { status: 'reading', pageCount: 300 });
    await ana.post(`/v1/books/${id}/progress`, { page: 100, timeZone: TZ });
    assert.equal((await finish(ana, id)).status, 204);
    const sesiones = (await env.db.collection('users/ana/sessions').get()).docs.map((d) => d.data());
    const ultima = sesiones.find((s) => s.endPage === 300);
    assert.equal(ultima?.startPage, 100);
    assert.equal(ultima?.pagesRead, 200);
    assert.equal(ultima?.durationMinutes, 0);
    const saved = await book(id);
    assert.equal(saved?.status, 'finished');
    assert.equal(saved?.currentPage, 300);
    assert.ok(saved?.finishedAt);
  });

  it('sin el total de páginas solo cambia el estado: no inventa páginas', async () => {
    const id = await createBook(ana, { status: 'reading', pageCount: undefined });
    assert.equal((await finish(ana, id)).status, 204);
    assert.equal((await book(id))?.status, 'finished');
    assert.equal((await env.db.collection('users/ana/sessions').get()).size, 0);
  });

  it('volver a terminar un libro reabierto no duplica la lectura', async () => {
    const id = await createBook(ana, { status: 'reading', pageCount: 300 });
    await finish(ana, id);
    await ana.put(`/v1/books/${id}/status`, { status: 'reading' });
    await finish(ana, id);
    assert.equal((await env.db.collection('users/ana/sessions').get()).size, 1);
    assert.equal((await book(id))?.status, 'finished');
  });

  it('un libro ya terminado no se toca', async () => {
    const id = await createBook(ana, { status: 'finished', pageCount: 300 });
    const antes = (await book(id))?.updatedAt;
    assert.equal((await finish(ana, id)).status, 204);
    assert.deepEqual((await book(id))?.updatedAt, antes);
    assert.equal((await env.db.collection('users/ana/sessions').get()).size, 0);
  });

  it('eliminar la lectura registrada al terminar reabre el libro en la página anterior', async () => {
    const id = await createBook(ana, { status: 'reading', pageCount: 300 });
    await ana.post(`/v1/books/${id}/progress`, { page: 100, timeZone: TZ });
    await finish(ana, id);
    const registrada = (await env.db.collection('users/ana/sessions').where('endPage', '==', 300).get()).docs[0];
    await ana.delete(`/v1/sessions/${registrada.id}`);
    const saved = await book(id);
    assert.equal(saved?.status, 'reading');
    assert.equal(saved?.currentPage, 100);
  });

  it('un deseo no se termina, y nadie termina el libro de otra persona', async () => {
    const deseo = await createBook(ana, { acquisition: 'wishlist', pageCount: 300 });
    assert.equal((await finish(ana, deseo)).status, 409);
    const id = await createBook(ana, { status: 'reading', pageCount: 300 });
    assert.equal((await finish(luis, id)).status, 404);
    assert.equal((await book(id))?.status, 'reading');
  });
});
