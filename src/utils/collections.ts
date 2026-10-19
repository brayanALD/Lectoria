import type { UserBookWithId } from '../types/book';
import type { Collection, CollectionFilters } from '../types/collection';
import { READING_STATUS_LABELS, formatBookCount } from './book';
import { EMPTY_FILTERS, filterBooks, normalizeText, type BookFilterState } from './bookFilters';

export const MAX_COLLECTION_NAME_LENGTH = 60;
/** Tope de libros de una colección manual (lo exigen las reglas de Firestore). */
export const MAX_COLLECTION_BOOKS = 500;

export type CollectionNameResult = { ok: true; name: string } | { ok: false; error: string };

/**
 * Valida el nombre de una colección: con contenido, de hasta 60 caracteres y sin repetir otro (sin distinguir tildes ni
 * mayúsculas). `ownId` es la colección que se renombra, para que su propio nombre no cuente como repetido.
 */
export function parseCollectionName(
  text: string,
  existing: readonly { id: string; name: string }[],
  ownId?: string,
): CollectionNameResult {
  const name = text.trim().replace(/\s+/g, ' ');
  if (!name) return { ok: false, error: 'Escribe un nombre.' };
  if (name.length > MAX_COLLECTION_NAME_LENGTH) {
    return { ok: false, error: `El nombre admite hasta ${MAX_COLLECTION_NAME_LENGTH} caracteres.` };
  }
  const key = normalizeText(name);
  if (existing.some((other) => other.id !== ownId && normalizeText(other.name) === key)) {
    return { ok: false, error: 'Ya tienes una colección con ese nombre.' };
  }
  return { ok: true, name };
}

/** Los filtros guardados de una estantería, como estado de filtros de Biblioteca. */
export function filtersToState(filters: CollectionFilters): BookFilterState {
  return {
    ...EMPTY_FILTERS,
    acquisition: filters.acquisition,
    query: filters.query ?? '',
    status: filters.status ?? null,
    genre: filters.genre ?? null,
    author: filters.author ?? null,
    series: filters.series ?? null,
  };
}

/**
 * Lo que se guarda de los filtros activos de Biblioteca: solo los criterios usados (nunca vacíos). El estado de lectura
 * solo vale en «Mis libros»: un deseo no tiene estado que filtrar.
 */
export function stateToFilters(state: BookFilterState): CollectionFilters {
  const filters: CollectionFilters = { acquisition: state.acquisition };
  const query = state.query.trim().replace(/\s+/g, ' ');
  if (query) filters.query = query;
  if (state.status && state.acquisition === 'owned') filters.status = state.status;
  if (state.genre) filters.genre = state.genre;
  if (state.author) filters.author = state.author;
  if (state.series) filters.series = state.series;
  return filters;
}

/** ¿Tiene algún criterio además de la lista? Sin él, una estantería sería solo «Mis libros» o «Deseos». */
export function hasFilterCriteria(filters: CollectionFilters): boolean {
  return Object.keys(filters).some((key) => key !== 'acquisition');
}

/**
 * Los libros de una colección. En una manual, los suyos en el orden en que se añadieron; un id que ya no existe se
 * ignora. En una estantería, los que cumplen sus filtros ahora mismo.
 */
export function resolveCollectionBooks(
  collection: Pick<Collection, 'kind' | 'bookIds' | 'filters'>,
  books: readonly UserBookWithId[],
): UserBookWithId[] {
  if (collection.kind === 'filter') {
    return collection.filters ? filterBooks(books, filtersToState(collection.filters)) : [];
  }
  const byId = new Map(books.map((book) => [book.id, book]));
  return (collection.bookIds ?? []).flatMap((id) => byId.get(id) ?? []);
}

/** Cuántos libros de una colección manual ya no existen (se borraron de la biblioteca). */
export function countMissingBooks(collection: Pick<Collection, 'kind' | 'bookIds'>, books: readonly UserBookWithId[]): number {
  if (collection.kind !== 'manual') return 0;
  const existing = new Set(books.map((book) => book.id));
  return (collection.bookIds ?? []).filter((id) => !existing.has(id)).length;
}

/** Quita los ids repetidos, conservando el orden. */
export function uniqueIds(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}

/** Añade o quita un libro de una selección. */
export function toggleBookId(ids: readonly string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((current) => current !== id) : [...ids, id];
}

export type BookSelectionResult = { ok: true; bookIds: string[] } | { ok: false; error: string };

/**
 * Valida la selección de libros que se guarda: sin repetidos, y solo libros que existen (así, al editar una colección,
 * los ids de libros borrados se van limpiando).
 */
export function parseBookSelection(ids: readonly string[], books: readonly UserBookWithId[]): BookSelectionResult {
  const existing = new Set(books.map((book) => book.id));
  const bookIds = uniqueIds(ids).filter((id) => existing.has(id));
  if (bookIds.length > MAX_COLLECTION_BOOKS) {
    return { ok: false, error: `Una colección admite hasta ${MAX_COLLECTION_BOOKS} libros.` };
  }
  return { ok: true, bookIds };
}

/** Los filtros de una estantería en una línea: «Deseos · Fantasía · Saga Dune». */
export function describeFilters(filters: CollectionFilters): string {
  const parts = [filters.acquisition === 'wishlist' ? 'Deseos' : 'Mis libros'];
  if (filters.status) parts.push(READING_STATUS_LABELS[filters.status]);
  if (filters.genre) parts.push(filters.genre);
  if (filters.author) parts.push(filters.author);
  if (filters.series) parts.push(`Saga ${filters.series}`);
  if (filters.query) parts.push(`«${filters.query}»`);
  return parts.join(' · ');
}

/** Las colecciones por nombre (en español, sin distinguir tildes ni mayúsculas). */
export function sortCollectionsByName<T extends Pick<Collection, 'name'>>(collections: readonly T[]): T[] {
  return [...collections].sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
}

/** Lo que se dice de una colección en una línea: sus libros y, si es una estantería, sus filtros. */
export function describeCollection(collection: Pick<Collection, 'kind' | 'bookIds' | 'filters'>, books: readonly UserBookWithId[]): string {
  const count = formatBookCount(resolveCollectionBooks(collection, books).length);
  return collection.kind === 'filter' && collection.filters ? `${count} · ${describeFilters(collection.filters)}` : count;
}

/** Busca libros por título o autor: cada palabra escrita debe aparecer (sin distinguir tildes ni mayúsculas). Por título. */
export function searchBooks(books: readonly UserBookWithId[], text: string): UserBookWithId[] {
  const tokens = normalizeText(text).split(' ').filter(Boolean);
  return books
    .filter((book) => {
      const haystack = normalizeText([book.title, ...book.authors].join(' '));
      return tokens.every((token) => haystack.includes(token));
    })
    .sort((a, b) => a.title.localeCompare(b.title, 'es', { sensitivity: 'base' }));
}
