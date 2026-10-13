import {
  EMPTY_FILTERS,
  countActiveFilters,
  filterBooks,
  getFilterOptions,
  hasActiveFilters,
  normalizeText,
} from './bookFilters';
import type { ReadingStatus } from '../types/book';

interface TestBook {
  title: string;
  authors: string[];
  status: ReadingStatus;
  genres?: string[];
  seriesName?: string;
}

const dune: TestBook = {
  title: 'Dune',
  authors: ['Frank Herbert'],
  status: 'reading',
  genres: ['Ciencia ficción'],
  seriesName: 'Crónicas de Dune',
};
const mesias: TestBook = {
  title: 'El mesías de Dune',
  authors: ['Frank Herbert'],
  status: 'want_to_read',
  genres: ['Ciencia ficción'],
  seriesName: 'Crónicas de Dune',
};
const cien: TestBook = {
  title: 'Cien años de soledad',
  authors: ['Gabriel García Márquez'],
  status: 'finished',
  genres: ['Realismo mágico', 'Novela'],
};
const sinDatos: TestBook = { title: 'Sin datos', authors: [], status: 'paused' };
const books = [dune, mesias, cien, sinDatos];

const titles = (list: TestBook[]) => list.map((book) => book.title);

describe('normalizeText', () => {
  it('quita tildes y mayúsculas y colapsa espacios', () => {
    expect(normalizeText('  Cien   AÑOS ')).toBe('cien anos');
    expect(normalizeText('García Márquez')).toBe('garcia marquez');
  });

  it('conserva la ñ como n al quitar la marca (se busca igual con o sin ella)', () => {
    expect(normalizeText('Ñandú')).toBe('nandu');
  });
});

describe('filterBooks — búsqueda de texto', () => {
  it('sin filtros devuelve todos los libros', () => {
    expect(filterBooks(books, EMPTY_FILTERS)).toHaveLength(4);
  });

  it('un texto vacío o solo con espacios no filtra', () => {
    expect(filterBooks(books, { ...EMPTY_FILTERS, query: '   ' })).toHaveLength(4);
  });

  it('busca en el título sin distinguir tildes ni mayúsculas', () => {
    expect(titles(filterBooks(books, { ...EMPTY_FILTERS, query: 'CIEN ANOS' }))).toEqual(['Cien años de soledad']);
    expect(titles(filterBooks(books, { ...EMPTY_FILTERS, query: 'mesias' }))).toEqual(['El mesías de Dune']);
  });

  it('busca también en autores, saga y géneros', () => {
    expect(titles(filterBooks(books, { ...EMPTY_FILTERS, query: 'marquez' }))).toEqual(['Cien años de soledad']);
    expect(titles(filterBooks(books, { ...EMPTY_FILTERS, query: 'cronicas' }))).toEqual(['Dune', 'El mesías de Dune']);
    expect(titles(filterBooks(books, { ...EMPTY_FILTERS, query: 'realismo' }))).toEqual(['Cien años de soledad']);
  });

  it('exige que aparezcan todas las palabras, en cualquier orden', () => {
    expect(titles(filterBooks(books, { ...EMPTY_FILTERS, query: 'herbert mesias' }))).toEqual(['El mesías de Dune']);
    expect(filterBooks(books, { ...EMPTY_FILTERS, query: 'herbert soledad' })).toEqual([]);
  });

  it('encuentra coincidencias parciales dentro de una palabra', () => {
    expect(titles(filterBooks(books, { ...EMPTY_FILTERS, query: 'sole' }))).toEqual(['Cien años de soledad']);
  });

  it('no falla con libros sin autores, géneros ni saga', () => {
    expect(titles(filterBooks(books, { ...EMPTY_FILTERS, query: 'sin datos' }))).toEqual(['Sin datos']);
  });
});

describe('filterBooks — filtros', () => {
  it('filtra por estado', () => {
    expect(titles(filterBooks(books, { ...EMPTY_FILTERS, status: 'reading' }))).toEqual(['Dune']);
  });

  it('filtra por género sin distinguir tildes ni mayúsculas', () => {
    expect(titles(filterBooks(books, { ...EMPTY_FILTERS, genre: 'CIENCIA FICCION' }))).toEqual(['Dune', 'El mesías de Dune']);
  });

  it('filtra por autor', () => {
    expect(titles(filterBooks(books, { ...EMPTY_FILTERS, author: 'frank herbert' }))).toEqual(['Dune', 'El mesías de Dune']);
  });

  it('filtra por saga y excluye los libros sin saga', () => {
    expect(titles(filterBooks(books, { ...EMPTY_FILTERS, series: 'Crónicas de Dune' }))).toEqual(['Dune', 'El mesías de Dune']);
  });

  it('combina todos los criterios (los cumple todos a la vez)', () => {
    const filters = { ...EMPTY_FILTERS, query: 'dune', status: 'want_to_read' as const, author: 'Frank Herbert' };
    expect(titles(filterBooks(books, filters))).toEqual(['El mesías de Dune']);
    expect(filterBooks(books, { ...filters, status: 'finished' })).toEqual([]);
  });

  it('conserva el orden original y no modifica la lista de entrada', () => {
    const input = [...books];
    filterBooks(input, { ...EMPTY_FILTERS, status: 'reading' });
    expect(input).toEqual(books);
  });
});

describe('getFilterOptions', () => {
  it('devuelve géneros, autores y sagas únicos y ordenados', () => {
    expect(getFilterOptions(books)).toEqual({
      genres: ['Ciencia ficción', 'Novela', 'Realismo mágico'],
      authors: ['Frank Herbert', 'Gabriel García Márquez'],
      series: ['Crónicas de Dune'],
    });
  });

  it('une variantes que solo difieren en tildes o mayúsculas, conservando la primera grafía', () => {
    const options = getFilterOptions([
      { title: 'A', authors: ['Ana'], status: 'reading', genres: ['Ciencia ficción'] },
      { title: 'B', authors: ['ANA'], status: 'reading', genres: ['ciencia ficcion'] },
    ]);
    expect(options.genres).toEqual(['Ciencia ficción']);
    expect(options.authors).toEqual(['Ana']);
  });

  it('ordena respetando el español (la «Á» va junto a la «A»)', () => {
    const options = getFilterOptions([
      { title: 'A', authors: ['Zeta', 'Álvaro', 'Beatriz', 'Alberto'], status: 'reading' },
    ]);
    expect(options.authors).toEqual(['Alberto', 'Álvaro', 'Beatriz', 'Zeta']);
  });

  it('devuelve listas vacías si no hay datos', () => {
    expect(getFilterOptions([])).toEqual({ genres: [], authors: [], series: [] });
    expect(getFilterOptions([sinDatos])).toEqual({ genres: [], authors: [], series: [] });
  });
});

describe('countActiveFilters / hasActiveFilters', () => {
  it('cuenta los filtros activos sin contar el texto de búsqueda', () => {
    expect(countActiveFilters(EMPTY_FILTERS)).toBe(0);
    expect(countActiveFilters({ ...EMPTY_FILTERS, query: 'dune', status: 'reading', genre: 'Novela' })).toBe(2);
  });

  it('detecta si hay búsqueda o algún filtro', () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, query: '  ' })).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, query: 'dune' })).toBe(true);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, series: 'Saga' })).toBe(true);
  });
});
