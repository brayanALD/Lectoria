import type { UserBook } from '../types/book';
import { normalizeText } from './bookFilters';
import { groupByName } from './groupNames';

type SeriesBook = Pick<UserBook, 'title' | 'status'> & Partial<Pick<UserBook, 'seriesName' | 'seriesOrder' | 'acquisition'>>;

/**
 * Una saga derivada de los libros (no existe como dato propio). El total real de la saga no se conoce: todo se cuenta
 * sobre los libros registrados.
 */
export interface SeriesSummary {
  /** Nombre visible: la grafía más repetida entre sus libros. */
  name: string;
  /** Libros registrados (propios y deseos). */
  books: number;
  finished: number;
  wishlist: number;
  /** Números de la saga que faltan entre el 1 y el mayor registrado. */
  missing: number[];
}

/** Las sagas de la biblioteca, en orden alfabético. */
export function summarizeSeries(books: readonly SeriesBook[]): SeriesSummary[] {
  return groupByName(books, (book) => (book.seriesName ? [book.seriesName] : [])).map((group) => ({
    name: group.name,
    books: group.items.length,
    finished: group.items.filter((book) => book.status === 'finished').length,
    wishlist: group.items.filter((book) => book.acquisition === 'wishlist').length,
    missing: getMissingNumbers(group.items.map((book) => book.seriesOrder)),
  }));
}

/** Los libros de una saga en su orden: por número (los que no lo tienen, al final) y, si empatan, por título. */
export function getSeriesBooks<T extends SeriesBook>(books: readonly T[], name: string): T[] {
  const key = normalizeText(name);
  return books
    .filter((book) => book.seriesName && normalizeText(book.seriesName) === key)
    .sort((a, b) => {
      const orderA = a.seriesOrder ?? Number.POSITIVE_INFINITY;
      const orderB = b.seriesOrder ?? Number.POSITIVE_INFINITY;
      if (orderA !== orderB) return orderA < orderB ? -1 : 1;
      return a.title.localeCompare(b.title, 'es', { sensitivity: 'base' });
    });
}

/** Los números enteros desde el 1 hasta el mayor que están sin cubrir. El 0 (una precuela) no cuenta como hueco. */
export function getMissingNumbers(orders: readonly (number | undefined)[]): number[] {
  const present = new Set<number>();
  for (const order of orders) if (order !== undefined && Number.isInteger(order) && order >= 1) present.add(order);
  const highest = Math.max(0, ...present);
  const missing: number[] = [];
  for (let number = 1; number <= highest; number++) if (!present.has(number)) missing.push(number);
  return missing;
}

/**
 * El siguiente libro por leer de una saga ya ordenada (ver `getSeriesBooks`): el primero que es propio y no está
 * terminado ni abandonado. Un deseo no se puede leer todavía.
 */
export function getNextToRead<T extends SeriesBook>(ordered: readonly T[]): T | undefined {
  return ordered.find(
    (book) => (book.acquisition ?? 'owned') === 'owned' && book.status !== 'finished' && book.status !== 'abandoned',
  );
}

/** El avance en una saga, sobre los libros registrados: «2 de 4 terminados». */
export function describeSeries(summary: Pick<SeriesSummary, 'books' | 'finished'>): string {
  return `${summary.finished} de ${summary.books} ${summary.books === 1 ? 'terminado' : 'terminados'}`;
}

const MAX_MISSING_SHOWN = 6;

/** Los números que faltan en una saga, en una frase: «Faltan los nº 3 y 4». Sin huecos, `undefined`. */
export function describeMissingNumbers(missing: readonly number[], limit: number = MAX_MISSING_SHOWN): string | undefined {
  if (missing.length === 0) return undefined;
  if (missing.length === 1) return `Falta el nº ${missing[0]}`;
  const shown = missing.slice(0, limit);
  const hidden = missing.length - shown.length;
  if (hidden > 0) return `Faltan los nº ${shown.join(', ')} y ${hidden} más`;
  return `Faltan los nº ${shown.slice(0, -1).join(', ')} y ${shown[shown.length - 1]}`;
}
