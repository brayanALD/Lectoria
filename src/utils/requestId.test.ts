import { makeRequestId, newRequestSeed } from './requestId';

// El formato que acepta la API (api/src/validation.ts → REQUEST_ID).
const API_FORMAT = /^[A-Za-z0-9_-]{8,100}$/;

describe('newRequestSeed', () => {
  it('cumple el formato de la API y no se repite', () => {
    const seeds = new Set(Array.from({ length: 200 }, newRequestSeed));
    expect(seeds.size).toBe(200);
    for (const seed of seeds) expect(seed).toMatch(API_FORMAT);
  });
});

describe('makeRequestId', () => {
  const seed = 'abc123xyz789';

  it('reintentar con lo mismo da el mismo id (aunque las claves lleguen en otro orden)', () => {
    const a = makeRequestId(seed, { title: 'Dune', authors: ['Frank Herbert'], pageCount: undefined });
    const b = makeRequestId(seed, { authors: ['Frank Herbert'], title: 'Dune' });
    expect(a).toBe(b);
  });

  it('cambiar cualquier dato da otro id', () => {
    const base = makeRequestId(seed, { title: 'Dune', authors: ['Frank Herbert'] });
    expect(makeRequestId(seed, { title: 'Dune', authors: ['Frank Herbert', 'Otro'] })).not.toBe(base);
    expect(makeRequestId(seed, { title: 'Dune ', authors: ['Frank Herbert'] })).not.toBe(base);
  });

  it('otra pantalla (otra semilla) da otro id para los mismos datos', () => {
    expect(makeRequestId('semilla-uno', { a: 1 })).not.toBe(makeRequestId('semilla-dos', { a: 1 }));
  });

  it('distingue fechas y cumple el formato de la API', () => {
    const one = makeRequestId(seed, { date: new Date('2026-10-13T10:00:00Z') });
    const two = makeRequestId(seed, { date: new Date('2026-10-13T10:00:01Z') });
    expect(one).not.toBe(two);
    expect(one).toMatch(API_FORMAT);
    expect(makeRequestId(seed, { texto: 'ñ / ¿? ' + 'x'.repeat(500) })).toMatch(API_FORMAT);
  });
});
