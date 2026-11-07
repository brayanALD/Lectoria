import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import { BASE_NOW, createBook, createProfile, readDoc, startEnv, type TestEnv } from './env';

let env: TestEnv;
before(async () => {
  env = await startEnv();
});
after(async () => {
  await env.close();
});
beforeEach(async () => {
  await env.clear();
});

describe('autenticación y errores generales', () => {
  it('la salud responde sin sesión y sin guardar nada en caché', async () => {
    const res = await env.raw('GET', '/v1/salud');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { status: 'ok' });
  });

  it('rechaza las solicitudes sin token o con un token no válido', async () => {
    const sin = await env.raw('GET', '/v1/me');
    assert.equal(sin.status, 401);
    assert.equal(sin.body.error.code, 'UNAUTHENTICATED');

    const malo = await env.raw('GET', '/v1/me', { Authorization: 'Bearer abc' });
    assert.equal(malo.status, 401);

    const esquema = await env.raw('GET', '/v1/me', { Authorization: 'Basic test-ana' });
    assert.equal(esquema.status, 401);
  });

  it('con sesión devuelve el uid de la persona', async () => {
    const res = await env.client('ana').get('/v1/me');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { uid: 'ana' });
  });

  it('responde 404 en JSON a una ruta inexistente y rechaza ids con caracteres extraños', async () => {
    const ana = env.client('ana');
    const ruta = await ana.get('/v1/nada');
    assert.equal(ruta.status, 404);
    assert.equal(ruta.body.error.code, 'ROUTE_NOT_FOUND');

    const id = await ana.patch('/v1/books/..%2Fotro', { title: 'x', authors: ['y'] });
    assert.equal(id.status, 404);
  });

  it('rechaza un JSON mal formado y un cuerpo que no es un objeto', async () => {
    const malformado = await fetch(`${env.base}/v1/books`, {
      method: 'POST',
      headers: { Authorization: 'Bearer test-ana', 'Content-Type': 'application/json' },
      body: '{no es json',
    });
    assert.equal(malformado.status, 400);

    const lista = await env.client('ana').post('/v1/books', [1, 2]);
    assert.equal(lista.status, 400);
    assert.equal(lista.body.error.code, 'VALIDATION');
  });

  it('limita las solicitudes por persona', async () => {
    const limited = await startEnv({ rateLimitPerMinute: 3 });
    try {
      const c = limited.client('ana');
      const statuses = [];
      for (let i = 0; i < 5; i++) statuses.push((await c.get('/v1/me')).status);
      assert.deepEqual(statuses, [200, 200, 200, 429, 429]);
      // Otra persona tiene su propia cuota.
      assert.equal((await limited.client('luis').get('/v1/me')).status, 200);
    } finally {
      await limited.close();
    }
  });
});

describe('perfil y metas', () => {
  it('crea el perfil una sola vez (idempotente) con el nombre indicado', async () => {
    const ana = env.client('ana');
    const first = await ana.post('/v1/me/profile', { displayName: '  Ana   María ', nickname: 'Ani', timeZone: 'America/Bogota' });
    assert.equal(first.status, 201);
    const again = await ana.post('/v1/me/profile', { displayName: 'Otra', timeZone: 'UTC' });
    assert.equal(again.status, 200);
    assert.equal(again.body.created, false);

    const profile = await readDoc(env.db, 'users/ana');
    assert.equal(profile?.displayName, 'Ana María');
    assert.equal(profile?.nickname, 'Ani');
    assert.equal(profile?.timeZone, 'America/Bogota');
    assert.ok(profile?.createdAt);
  });

  it('sin nombre usa el correo y con una zona inválida cae a UTC', async () => {
    const res = await env.client('luis').post('/v1/me/profile', { timeZone: 'No/Existe' });
    assert.equal(res.status, 201);
    const profile = await readDoc(env.db, 'users/luis');
    assert.equal(profile?.displayName, 'luis');
    assert.equal(profile?.timeZone, 'UTC');
  });

  it('valida los límites del nombre', async () => {
    const res = await env.client('ana').post('/v1/me/profile', { displayName: 'x'.repeat(61), timeZone: 'UTC' });
    assert.equal(res.status, 400);
    assert.ok(res.body.error.fields.displayName);
  });

  it('la meta diaria es de minutos o de páginas, nunca las dos', async () => {
    const ana = env.client('ana');
    await createProfile(ana);

    assert.equal((await ana.put('/v1/me/daily-goal', { type: 'minutes', target: 30 })).status, 204);
    let profile = await readDoc(env.db, 'users/ana');
    assert.equal(profile?.dailyGoalMinutes, 30);
    assert.equal(profile?.dailyGoalPages, undefined);

    assert.equal((await ana.put('/v1/me/daily-goal', { type: 'pages', target: 20 })).status, 204);
    profile = await readDoc(env.db, 'users/ana');
    assert.equal(profile?.dailyGoalPages, 20);
    assert.equal(profile?.dailyGoalMinutes, undefined);

    assert.equal((await ana.delete('/v1/me/daily-goal')).status, 204);
    profile = await readDoc(env.db, 'users/ana');
    assert.equal(profile?.dailyGoalPages, undefined);
  });

  it('rechaza metas fuera de los límites o de un tipo desconocido', async () => {
    const ana = env.client('ana');
    await createProfile(ana);
    for (const body of [
      { type: 'minutes', target: 0 },
      { type: 'minutes', target: 1441 },
      { type: 'pages', target: 10001 },
      { type: 'minutes', target: 2.5 },
      { type: 'minutes', target: '30' },
      { type: 'horas', target: 3 },
      { type: 'minutes' },
    ]) {
      const res = await ana.put('/v1/me/daily-goal', body);
      assert.equal(res.status, 400, JSON.stringify(body));
    }
  });

  it('el objetivo mensual de libros respeta 1–1000 y se puede quitar', async () => {
    const ana = env.client('ana');
    await createProfile(ana);
    assert.equal((await ana.put('/v1/me/monthly-goal', { target: 4 })).status, 204);
    assert.equal((await readDoc(env.db, 'users/ana'))?.monthlyBooksGoal, 4);
    assert.equal((await ana.put('/v1/me/monthly-goal', { target: 1001 })).status, 400);
    assert.equal((await ana.put('/v1/me/monthly-goal', { target: 0 })).status, 400);
    assert.equal((await ana.delete('/v1/me/monthly-goal')).status, 204);
    assert.equal((await readDoc(env.db, 'users/ana'))?.monthlyBooksGoal, undefined);
  });

  it('cambiar una meta sin perfil responde 404 y no crea el perfil', async () => {
    const res = await env.client('ana').put('/v1/me/daily-goal', { type: 'minutes', target: 10 });
    assert.equal(res.status, 404);
    assert.equal(await readDoc(env.db, 'users/ana'), undefined);
  });
});

describe('eliminar los datos de la cuenta', () => {
  it('borra libros, lecturas, colecciones y perfil de esa persona, y nada de las demás', async () => {
    const ana = env.client('ana');
    const luis = env.client('luis');
    await createProfile(ana);
    await createProfile(luis);
    const libro = await createBook(ana);
    await createBook(luis);
    await ana.post('/v1/sessions', { bookId: libro, date: BASE_NOW.toISOString(), timeZone: 'America/Bogota', durationMinutes: 20 });
    await ana.post('/v1/collections', { kind: 'manual', name: 'Favoritos', bookIds: [libro] });

    assert.equal((await ana.delete('/v1/me/data')).status, 204);

    assert.equal((await env.db.collection('users/ana/books').get()).size, 0);
    assert.equal((await env.db.collection('users/ana/sessions').get()).size, 0);
    assert.equal((await env.db.collection('users/ana/collections').get()).size, 0);
    assert.equal(await readDoc(env.db, 'users/ana'), undefined);
    // La otra persona conserva todo.
    assert.equal((await env.db.collection('users/luis/books').get()).size, 1);
    assert.ok(await readDoc(env.db, 'users/luis'));

    // Repetirlo no es un error.
    assert.equal((await ana.delete('/v1/me/data')).status, 204);
  });
});
