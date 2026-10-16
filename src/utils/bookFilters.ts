import type { Acquisition, ReadingStatus, UserBook } from '../types/book';
import { READING_STATUS_LABELS } from './book';

/** Estado de búsqueda y filtros de la Biblioteca. `null` = sin filtrar por ese criterio. */
export interface BookFilterState {
  /** Qué lista se ve: los libros propios o los deseos. No se puede dejar sin elegir. */
  acquisition: Acquisition;
  query: string;
  status: ReadingStatus | null;
  genre: string | null;
  author: string | null;
  series: string | null;
}

export const EMPTY_FILTERS: BookFilterState = {
  acquisition: 'owned',
  query: '',
  status: null,
  genre: null,
  author: null,
  series: null,
};

/** Quita la búsqueda y los filtros pero se queda en la misma lista (propios o deseos). */
export function clearFilters(filters: BookFilterState): BookFilterState {
  return { ...EMPTY_FILTERS, acquisition: filters.acquisition };
}

/** Lo que necesitan los filtros de un libro (sin depender de Firebase ni del id). */
type FilterableBook = Pick<UserBook, 'title' | 'authors' | 'status'> &
  Partial<Pick<UserBook, 'genres' | 'seriesName' | 'acquisition'>>;

/** Los libros de una lista: los propios o los deseos. Un libro sin el dato cuenta como propio. */
export function filterByAcquisition<T extends { acquisition?: Acquisition }>(books: readonly T[], acquisition: Acquisition): T[] {
  return books.filter((book) => (book.acquisition ?? 'owned') === acquisition);
}

/** Sin tildes ni mayúsculas, con espacios colapsados: «  Cien AÑOS » → «cien anos». */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const sameText = (a: string, b: string) => normalizeText(a) === normalizeText(b);

/**
 * Libros que cumplen TODOS los criterios activos.
 * La búsqueda de texto exige que cada palabra aparezca en el título, los autores, la saga o los géneros
 * (en cualquier orden), así «herbert dune» encuentra «Dune» de Frank Herbert.
 */
export function filterBooks<T extends FilterableBook>(books: readonly T[], filters: BookFilterState): T[] {
  const tokens = normalizeText(filters.query).split(' ').filter(Boolean);

  return books.filter((book) => {
    if ((book.acquisition ?? 'owned') !== filters.acquisition) return false;
    if (filters.status && book.status !== filters.status) return false;
    if (filters.genre && !(book.genres ?? []).some((genre) => sameText(genre, filters.genre!))) return false;
    if (filters.author && !book.authors.some((author) => sameText(author, filters.author!))) return false;
    if (filters.series && !(book.seriesName && sameText(book.seriesName, filters.series))) return false;

    if (tokens.length > 0) {
      const haystack = normalizeText([book.title, ...book.authors, book.seriesName ?? '', ...(book.genres ?? [])].join(' '));
      if (!tokens.every((token) => haystack.includes(token))) return false;
    }
    return true;
  });
}

export interface BookFilterOptions {
  genres: string[];
  authors: string[];
  series: string[];
}

/** Valores únicos (sin distinguir tildes ni mayúsculas) y ordenados alfabéticamente, para ofrecer como filtros. */
export function getFilterOptions(books: readonly FilterableBook[]): BookFilterOptions {
  const collect = (values: Iterable<string>): string[] => {
    const unique = new Map<string, string>();
    for (const value of values) {
      const key = normalizeText(value);
      if (key && !unique.has(key)) unique.set(key, value.trim());
    }
    return [...unique.values()].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  };

  return {
    genres: collect(books.flatMap((book) => book.genres ?? [])),
    authors: collect(books.flatMap((book) => book.authors)),
    series: collect(books.flatMap((book) => (book.seriesName ? [book.seriesName] : []))),
  };
}

/** Cuántos filtros (sin contar el texto de búsqueda) hay activos. */
export function countActiveFilters(filters: BookFilterState): number {
  return [filters.status, filters.genre, filters.author, filters.series].filter(Boolean).length;
}

/** ¿Hay búsqueda o algún filtro activo? */
export function hasActiveFilters(filters: BookFilterState): boolean {
  return normalizeText(filters.query) !== '' || countActiveFilters(filters) > 0;
}

export type ActiveFilterKey = 'status' | 'genre' | 'author' | 'series';

/** Un filtro activo tal como se muestra en el resumen de la Biblioteca (un chip que se puede quitar). */
export interface ActiveFilter {
  key: ActiveFilterKey;
  label: string;
}

/**
 * Los filtros activos (sin la búsqueda de texto) en el orden de la hoja de filtros. El estado de lectura solo cuenta en
 * «Mis libros»: un deseo aún no se ha empezado y no tiene estado que filtrar.
 */
export function getActiveFilters(filters: BookFilterState): ActiveFilter[] {
  const active: ActiveFilter[] = [];
  if (filters.status && filters.acquisition === 'owned') active.push({ key: 'status', label: READING_STATUS_LABELS[filters.status] });
  if (filters.genre) active.push({ key: 'genre', label: filters.genre });
  if (filters.author) active.push({ key: 'author', label: filters.author });
  if (filters.series) active.push({ key: 'series', label: `Saga ${filters.series}` });
  return active;
}

/** Quita un solo filtro, sin tocar los demás ni la búsqueda. */
export function removeFilter(filters: BookFilterState, key: ActiveFilterKey): BookFilterState {
  return { ...filters, [key]: null };
}
