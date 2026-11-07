import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import { createBook, createProfile, readDoc, startEnv, type Client, type TestEnv } from './env';

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

const col = (id: string, uid = 'ana') => readDoc(env.db, `users/${uid}/collections/${id}`);

describe('crear colecciones', () => {
  it('crea una colección manual con sus libros, con fechas del servidor', async () => {
    const a = await createBook(ana);
    const b = await createBook(ana, { title: 'Hyperion' });
    const res = await ana.post('/v1/collections', { kind: 'manual', name: '  Ciencia   ficción ', bookIds: [a, b, a] });
    assert.equal(res.status, 201);
    const saved = await col(res.body.id);
    assert.equal(saved?.name, 'Ciencia ficción');
    assert.equal(saved?.kind, 'manual');
    assert.deepEqual(saved?.bookIds, [a, b]);
    assert.equal(saved?.filters, undefined);
    assert.ok(saved?.createdAt && saved?.updatedAt);
  });

  it('crea una colección manual vacía', async () => {
    const res = await ana.post('/v1/collections', { kind: 'manual', name: 'Pendientes' });
    assert.equal(res.status, 201);
    assert.deepEqual((await col(res.body.id))?.bookIds, []);
  });

  it('descarta los libros que no existen o son de otra persona', async () => {
    const mio = await createBook(ana);
    const ajeno = await createBook(luis);
    const res = await ana.post('/v1/collections', { kind: 'manual', name: 'Mezcla', bookIds: [mio, ajeno, 'fantasma'] });
    assert.deepEqual((await col(res.body.id))?.bookIds, [mio]);
  });

  it('crea una estantería filtrada y solo guarda los criterios usados', async () => {
    const res = await ana.post('/v1/collections', {
      kind: 'filter',
      name: 'Fantasía sin leer',
      filters: { acquisition: 'owned', status: 'want_to_read', genre: '  Fantasía ', query: '', author: undefined },
    });
    assert.equal(res.status, 201);
    const saved = await col(res.body.id);
    assert.deepEqual(saved?.filters, { acquisition: 'owned', status: 'want_to_read', genre: 'Fantasía' });
    assert.equal(saved?.bookIds, undefined);
  });

  it('en los deseos el estado de lectura no se guarda', async () => {
    const res = await ana.post('/v1/collections', {
      kind: 'filter',
      name: 'Deseos de Sanderson',
      filters: { acquisition: 'wishlist', status: 'reading', author: 'Sanderson' },
    });
    assert.deepEqual((await col(res.body.id))?.filters, { acquisition: 'wishlist', author: 'Sanderson' });
  });

  it('rechaza nombres vacíos o de más de 60 caracteres (admite exactamente 60) y nombres repetidos', async () => {
    assert.equal((await ana.post('/v1/collections', { kind: 'manual', name: '   ' })).status, 400);
    assert.equal((await ana.post('/v1/collections', { kind: 'manual', name: 'x'.repeat(61) })).status, 400);
    assert.equal((await ana.post('/v1/collections', { kind: 'manual', name: 'x'.repeat(60) })).status, 201);
    await ana.post('/v1/collections', { kind: 'manual', name: 'Favoritos' });
    const repetido = await ana.post('/v1/collections', { kind: 'manual', name: 'FAVORITOS' });
    assert.equal(repetido.status, 400);
    assert.ok(repetido.body.error.fields.name);
    // Otra persona sí puede usar el mismo nombre.
    assert.equal((await luis.post('/v1/collections', { kind: 'manual', name: 'Favoritos' })).status, 201);
  });

  it('rechaza un tipo desconocido, filtros ausentes o sin criterio, y filtros inválidos', async () => {
    for (const body of [
      { kind: 'otra', name: 'x' },
      { name: 'x' },
      { kind: 'filter', name: 'x' },
      { kind: 'filter', name: 'x', filters: { acquisition: 'owned' } },
      { kind: 'filter', name: 'x', filters: { acquisition: 'owned', query: '   ' } },
      { kind: 'filter', name: 'x', filters: { acquisition: 'prestado', genre: 'a' } },
      { kind: 'filter', name: 'x', filters: { acquisition: 'owned', status: 'dormido' } },
      { kind: 'filter', name: 'x', filters: { acquisition: 'owned', genre: 'g'.repeat(401) } },
      { kind: 'manual', name: 'x', bookIds: 'abc' },
      { kind: 'manual', name: 'x', bookIds: ['a/b'] },
    ]) {
      assert.equal((await ana.post('/v1/collections', body)).status, 400, JSON.stringify(body));
    }
  });

  it('admite hasta 500 libros y rechaza más', async () => {
    const ids = Array.from({ length: 501 }, (_, i) => `libro-${i}`);
    const res = await ana.post('/v1/collections', { kind: 'manual', name: 'Enorme', bookIds: ids });
    assert.equal(res.status, 400);
    assert.ok(res.body.error.fields.bookIds);
  });

  it('con requestId, repetir la creación no duplica la colección (ni choca con su propio nombre)', async () => {
    const body = { requestId: 'coleccion-001', kind: 'manual', name: 'Favoritos' };
    const first = await ana.post('/v1/collections', body);
    const second = await ana.post('/v1/collections', body);
    assert.equal(first.status, 201);
    assert.equal(second.status, 200);
    assert.equal(second.body.repeated, true);
    assert.equal((await env.db.collection('users/ana/collections').get()).size, 1);
  });
});

describe('editar y eliminar colecciones', () => {
  it('renombra sin tocar los libros, y reemplaza los libros de una manual', async () => {
    const a = await createBook(ana);
    const b = await createBook(ana, { title: 'Hyperion' });
    const { body } = await ana.post('/v1/collections', { kind: 'manual', name: 'Viejo', bookIds: [a] });
    assert.equal((await ana.patch(`/v1/collections/${body.id}`, { name: 'Nuevo' })).status, 204);
    assert.deepEqual({ name: (await col(body.id))?.name, ids: (await col(body.id))?.bookIds }, { name: 'Nuevo', ids: [a] });

    await ana.patch(`/v1/collections/${body.id}`, { bookIds: [b] });
    assert.deepEqual((await col(body.id))?.bookIds, [b]);

    await ana.patch(`/v1/collections/${body.id}`, { name: 'Ambos', bookIds: [a, b] });
    const saved = await col(body.id);
    assert.equal(saved?.name, 'Ambos');
    assert.deepEqual(saved?.bookIds, [a, b]);
  });

  it('al guardar se limpian los libros que ya no existen', async () => {
    const a = await createBook(ana);
    const { body } = await ana.post('/v1/collections', { kind: 'manual', name: 'Lista', bookIds: [a] });
    await ana.delete(`/v1/books/${a}`);
    await ana.patch(`/v1/collections/${body.id}`, { bookIds: [a] });
    assert.deepEqual((await col(body.id))?.bookIds, []);
  });

  it('una estantería solo cambia de nombre y nunca cambia de tipo', async () => {
    const { body } = await ana.post('/v1/collections', { kind: 'filter', name: 'Filtro', filters: { acquisition: 'owned', genre: 'Fantasía' } });
    assert.equal((await ana.patch(`/v1/collections/${body.id}`, { bookIds: ['x'] })).status, 400);
    assert.equal((await ana.patch(`/v1/collections/${body.id}`, { name: 'Renombrada', kind: 'manual' })).status, 204);
    const saved = await col(body.id);
    assert.equal(saved?.name, 'Renombrada');
    assert.equal(saved?.kind, 'filter');
    assert.equal(saved?.bookIds, undefined);
  });

  it('renombrar permite conservar el propio nombre pero no usar el de otra colección', async () => {
    const a = await ana.post('/v1/collections', { kind: 'manual', name: 'Uno' });
    await ana.post('/v1/collections', { kind: 'manual', name: 'Dos' });
    assert.equal((await ana.patch(`/v1/collections/${a.body.id}`, { name: 'uno' })).status, 204);
    assert.equal((await ana.patch(`/v1/collections/${a.body.id}`, { name: 'Dos' })).status, 400);
  });

  it('elimina la colección sin tocar sus libros, y es idempotente', async () => {
    const a = await createBook(ana);
    const { body } = await ana.post('/v1/collections', { kind: 'manual', name: 'Lista', bookIds: [a] });
    assert.equal((await ana.delete(`/v1/collections/${body.id}`)).status, 204);
    assert.equal(await col(body.id), undefined);
    assert.ok(await readDoc(env.db, `users/ana/books/${a}`));
    assert.equal((await ana.delete(`/v1/collections/${body.id}`)).status, 204);
  });

  it('una colección inexistente responde 404 al editarla', async () => {
    assert.equal((await ana.patch('/v1/collections/fantasma', { name: 'x' })).status, 404);
  });

  it('nadie lee, cambia ni borra las colecciones de otra persona', async () => {
    const { body } = await ana.post('/v1/collections', { kind: 'manual', name: 'Privada' });
    assert.equal((await luis.patch(`/v1/collections/${body.id}`, { name: 'Robada' })).status, 404);
    await luis.delete(`/v1/collections/${body.id}`);
    assert.equal((await col(body.id))?.name, 'Privada');
  });
});
