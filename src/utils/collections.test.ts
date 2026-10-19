import type { ReadingStatus, UserBookWithId } from '../types/book';
import type { CollectionFilters } from '../types/collection';
import { EMPTY_FILTERS } from './bookFilters';
import {
  MAX_COLLECTION_BOOKS,
  MAX_COLLECTION_NAME_LENGTH,
  countMissingBooks,
  describeCollection,
  describeFilters,
  filtersToState,
  hasFilterCriteria,
  parseBookSelection,
  parseCollectionName,
  resolveCollectionBooks,
  searchBooks,
  sortCollectionsByName,
  stateToFilters,
  toggleBookId,
  uniqueIds,
} from './collections';

const book = (
  id: string,
  title: string,
  extra: Partial<Pick<UserBookWithId, 'authors' | 'genres' | 'seriesName' | 'acquisition'>> & { status?: ReadingStatus } = {},
) =>
  ({
    id,
    title,
    authors: extra.authors ?? ['Ana'],
    genres: extra.genres,
    seriesName: extra.seriesName,
    status: extra.status ?? 'want_to_read',
    acquisition: extra.acquisition ?? 'owned',
    currentPage: 0,
  }) as UserBookWithId;

const books = [
  book('a', 'Alfa', { genres: ['Fantasía'] }),
  book('b', 'Beta', { genres: ['Ciencia ficción'], status: 'finished' }),
  book('c', 'Gamma', { genres: ['Fantasía'], acquisition: 'wishlist' }),
];

describe('parseCollectionName', () => {
  const existing = [{ id: '1', name: 'Para regalar' }];

  it('acepta un nombre y le quita los espacios sobrantes', () => {
    expect(parseCollectionName('  Verano   2026 ', existing)).toEqual({ ok: true, name: 'Verano 2026' });
  });

  it('rechaza un nombre vacío', () => {
    expect(parseCollectionName('   ', existing)).toEqual({ ok: false, error: 'Escribe un nombre.' });
  });

  it('rechaza un nombre demasiado largo y admite el máximo exacto', () => {
    expect(parseCollectionName('a'.repeat(MAX_COLLECTION_NAME_LENGTH + 1), existing).ok).toBe(false);
    expect(parseCollectionName('a'.repeat(MAX_COLLECTION_NAME_LENGTH), existing).ok).toBe(true);
  });

  it('rechaza un nombre repetido sin distinguir tildes ni mayúsculas', () => {
    expect(parseCollectionName('PARA REGALAR', existing)).toEqual({ ok: false, error: 'Ya tienes una colección con ese nombre.' });
    expect(parseCollectionName('para  régalar', existing).ok).toBe(false);
  });

  it('al renombrar, el propio nombre no cuenta como repetido', () => {
    expect(parseCollectionName('Para regalar', existing, '1').ok).toBe(true);
    expect(parseCollectionName('Para regalar', existing, '2').ok).toBe(false);
  });
});

describe('estado de filtros y filtros guardados', () => {
  it('guarda solo los criterios usados', () => {
    expect(stateToFilters({ ...EMPTY_FILTERS, genre: 'Fantasía' })).toEqual({ acquisition: 'owned', genre: 'Fantasía' });
    expect(stateToFilters(EMPTY_FILTERS)).toEqual({ acquisition: 'owned' });
  });

  it('limpia el texto de búsqueda y no guarda una búsqueda vacía', () => {
    expect(stateToFilters({ ...EMPTY_FILTERS, query: '  dune   herbert ' }).query).toBe('dune herbert');
    expect('query' in stateToFilters({ ...EMPTY_FILTERS, query: '   ' })).toBe(false);
  });

  it('el estado de lectura solo se guarda en «Mis libros»', () => {
    expect(stateToFilters({ ...EMPTY_FILTERS, status: 'reading' }).status).toBe('reading');
    expect('status' in stateToFilters({ ...EMPTY_FILTERS, acquisition: 'wishlist', status: 'reading' })).toBe(false);
  });

  it('ida y vuelta: los filtros guardados dan el mismo estado', () => {
    const state = { ...EMPTY_FILTERS, acquisition: 'owned' as const, query: 'dune', status: 'reading' as const, genre: 'Fantasía', author: 'Ana', series: 'Dune' };
    expect(filtersToState(stateToFilters(state))).toEqual(state);
  });

  it('hace falta algún criterio además de la lista', () => {
    expect(hasFilterCriteria({ acquisition: 'wishlist' })).toBe(false);
    expect(hasFilterCriteria({ acquisition: 'wishlist', genre: 'Fantasía' })).toBe(true);
  });
});

describe('resolveCollectionBooks', () => {
  it('una colección manual devuelve sus libros en el orden en que se añadieron', () => {
    expect(resolveCollectionBooks({ kind: 'manual', bookIds: ['c', 'a'] }, books).map((item) => item.id)).toEqual(['c', 'a']);
  });

  it('ignora los ids de libros que ya no existen', () => {
    const collection = { kind: 'manual' as const, bookIds: ['a', 'borrado', 'b'] };
    expect(resolveCollectionBooks(collection, books).map((item) => item.id)).toEqual(['a', 'b']);
    expect(countMissingBooks(collection, books)).toBe(1);
  });

  it('una colección manual sin libros está vacía', () => {
    expect(resolveCollectionBooks({ kind: 'manual' }, books)).toEqual([]);
    expect(countMissingBooks({ kind: 'manual' }, books)).toBe(0);
  });

  it('una estantería devuelve los libros que cumplen sus filtros ahora', () => {
    const shelf = { kind: 'filter' as const, filters: { acquisition: 'owned', genre: 'Fantasía' } as CollectionFilters };
    expect(resolveCollectionBooks(shelf, books).map((item) => item.id)).toEqual(['a']);
    const wishes = { kind: 'filter' as const, filters: { acquisition: 'wishlist', genre: 'Fantasía' } as CollectionFilters };
    expect(resolveCollectionBooks(wishes, books).map((item) => item.id)).toEqual(['c']);
  });

  it('una estantería se actualiza sola al llegar libros nuevos', () => {
    const shelf = { kind: 'filter' as const, filters: { acquisition: 'owned', genre: 'Fantasía' } as CollectionFilters };
    const more = [...books, book('d', 'Delta', { genres: ['fantasia'] })];
    expect(resolveCollectionBooks(shelf, more).map((item) => item.id)).toEqual(['a', 'd']);
  });

  it('una estantería no tiene libros «perdidos»', () => {
    expect(countMissingBooks({ kind: 'filter' }, books)).toBe(0);
  });
});

describe('selección de libros', () => {
  it('toggleBookId añade al final y quita si ya estaba', () => {
    expect(toggleBookId(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleBookId(['a', 'b'], 'a')).toEqual(['b']);
  });

  it('uniqueIds quita repetidos conservando el orden', () => {
    expect(uniqueIds(['b', 'a', 'b'])).toEqual(['b', 'a']);
  });

  it('parseBookSelection descarta repetidos y libros que ya no existen', () => {
    expect(parseBookSelection(['a', 'a', 'x', 'b'], books)).toEqual({ ok: true, bookIds: ['a', 'b'] });
  });

  it('parseBookSelection admite una selección vacía', () => {
    expect(parseBookSelection([], books)).toEqual({ ok: true, bookIds: [] });
  });

  it('parseBookSelection rechaza más libros del máximo', () => {
    const many = Array.from({ length: MAX_COLLECTION_BOOKS + 1 }, (_, index) => book(`id${index}`, `Libro ${index}`));
    const ids = many.map((item) => item.id);
    expect(parseBookSelection(ids, many).ok).toBe(false);
    expect(parseBookSelection(ids.slice(1), many).ok).toBe(true);
  });
});

describe('describeFilters', () => {
  it('resume la lista y los criterios en una línea', () => {
    expect(describeFilters({ acquisition: 'wishlist' })).toBe('Deseos');
    expect(describeFilters({ acquisition: 'owned', status: 'reading', genre: 'Fantasía', author: 'Ana', series: 'Dune', query: 'dune' })).toBe(
      'Mis libros · Leyendo · Fantasía · Ana · Saga Dune · «dune»',
    );
  });
});

describe('sortCollectionsByName', () => {
  it('ordena por nombre en español sin distinguir tildes ni mayúsculas, sin tocar la lista original', () => {
    const list = [{ name: 'zeta' }, { name: 'Árboles' }, { name: 'Beta' }];
    expect(sortCollectionsByName(list).map((item) => item.name)).toEqual(['Árboles', 'Beta', 'zeta']);
    expect(list.map((item) => item.name)).toEqual(['zeta', 'Árboles', 'Beta']);
  });
});

describe('describeCollection', () => {
  it('una manual dice cuántos libros tiene, sin contar los que ya no existen', () => {
    expect(describeCollection({ kind: 'manual', bookIds: ['a', 'borrado'] }, books)).toBe('1 libro');
    expect(describeCollection({ kind: 'manual' }, books)).toBe('0 libros');
  });

  it('una estantería dice cuántos libros cumplen sus filtros y cuáles son', () => {
    const shelf = { kind: 'filter' as const, filters: { acquisition: 'owned', genre: 'Fantasía' } as CollectionFilters };
    expect(describeCollection(shelf, books)).toBe('1 libro · Mis libros · Fantasía');
  });
});

describe('searchBooks', () => {
  it('sin texto devuelve todos, por título', () => {
    expect(searchBooks(books, '').map((item) => item.title)).toEqual(['Alfa', 'Beta', 'Gamma']);
  });

  it('exige que aparezcan todas las palabras en el título o los autores, sin distinguir tildes ni mayúsculas', () => {
    const list = [book('1', 'Cien años de soledad', { authors: ['Gabriel García Márquez'] }), book('2', 'Otro', { authors: ['Ana'] })];
    expect(searchBooks(list, 'GARCIA soledad').map((item) => item.id)).toEqual(['1']);
    expect(searchBooks(list, 'garcia ana')).toEqual([]);
  });
});
