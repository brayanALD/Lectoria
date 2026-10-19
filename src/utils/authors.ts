import type { UserBook } from '../types/book';
import { formatBookCount } from './book';
import { normalizeText } from './bookFilters';
import { groupByName } from './groupNames';

type AuthorBook = Pick<UserBook, 'authors' | 'status'> & Partial<Pick<UserBook, 'acquisition'>>;

/** Un autor derivado de los libros (no existe como dato propio): cuántos libros tiene en la biblioteca. */
export interface AuthorSummary {
  /** Nombre visible: la grafía más repetida entre sus libros. */
  name: string;
  /** Libros propios y deseos. */
  books: number;
  finished: number;
  wishlist: number;
}

/** Los autores de la biblioteca, en orden alfabético. Un libro con varios autores cuenta para cada uno. */
export function summarizeAuthors(books: readonly AuthorBook[]): AuthorSummary[] {
  return groupByName(books, (book) => book.authors).map((group) => ({
    name: group.name,
    books: group.items.length,
    finished: group.items.filter((book) => book.status === 'finished').length,
    wishlist: group.items.filter((book) => book.acquisition === 'wishlist').length,
  }));
}

/** Los libros de un autor (sin distinguir tildes ni mayúsculas), por título. */
export function getAuthorBooks<T extends Pick<UserBook, 'authors' | 'title'>>(books: readonly T[], name: string): T[] {
  const key = normalizeText(name);
  return books
    .filter((book) => book.authors.some((author) => normalizeText(author) === key))
    .sort((a, b) => a.title.localeCompare(b.title, 'es', { sensitivity: 'base' }));
}

/** Lo que se dice de un autor en una línea: «3 libros · 1 terminado». */
export function describeAuthor(summary: Pick<AuthorSummary, 'books' | 'finished'>): string {
  const books = formatBookCount(summary.books);
  if (summary.finished === 0) return books;
  return `${books} · ${summary.finished} ${summary.finished === 1 ? 'terminado' : 'terminados'}`;
}
