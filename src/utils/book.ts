import type {
  Acquisition,
  BookFormErrors,
  BookFormResult,
  BookFormValues,
  NewBookFields,
  ReadingStatus,
  UserBook,
} from '../types/book';
import { getIsbnErrorMessage, parseIsbn } from './isbn';

// Límites alineados con firestore.rules (validBook). Los de cada elemento de las listas
// no los comprueban las reglas, pero evitan datos absurdos.
export const MAX_TITLE_LENGTH = 300;
export const MAX_AUTHORS = 20;
export const MAX_AUTHOR_LENGTH = 120;
export const MAX_GENRES = 20;
export const MAX_GENRE_LENGTH = 60;
export const MAX_SERIES_NAME_LENGTH = 200;
export const MAX_SERIES_ORDER = 1000;
export const MAX_PAGE_COUNT = 100000;

export const READING_STATUSES: readonly ReadingStatus[] = [
  'want_to_read',
  'reading',
  'paused',
  'finished',
  'abandoned',
];

export const READING_STATUS_LABELS: Record<ReadingStatus, string> = {
  want_to_read: 'Quiero leerlo',
  reading: 'Leyendo',
  paused: 'En pausa',
  finished: 'Terminado',
  abandoned: 'Abandonado',
};

export const DEFAULT_READING_STATUS: ReadingStatus = 'want_to_read';

export const MAX_COVER_URL_LENGTH = 2000;

export const EMPTY_BOOK_FORM: BookFormValues = {
  isbn13: '',
  coverUrl: '',
  title: '',
  authors: '',
  pageCount: '',
  genres: '',
  seriesName: '',
  seriesOrder: '',
  status: DEFAULT_READING_STATUS,
};

/** Separa por coma o punto y coma, recorta, descarta vacíos y elimina duplicados (sin distinguir mayúsculas). */
export function splitList(text: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const part of text.split(/[,;\n]/)) {
    const item = part.trim().replace(/\s+/g, ' ');
    const key = item.toLowerCase();
    if (item && !seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}

const INTEGER = /^\d+$/;

/**
 * Valida el formulario de «Añadir libro» y lo convierte en los campos que se guardan.
 * No devuelve claves con valor undefined (Firestore las rechaza) ni fechas: esas las añade el servicio.
 * Un libro nuevo entra a la biblioteca (`owned`) salvo que se añada a la lista de deseos (`wishlist`): un deseo
 * todavía no se ha empezado, así que se guarda como «Quiero leerlo» y en la página 0, sea cual sea el estado del formulario.
 */
export function parseBookForm(values: BookFormValues, acquisition: Acquisition = 'owned'): BookFormResult {
  const errors: BookFormErrors = {};

  const title = values.title.trim().replace(/\s+/g, ' ');
  if (!title) errors.title = 'Introduce el título.';
  else if (title.length > MAX_TITLE_LENGTH) errors.title = `El título no puede superar ${MAX_TITLE_LENGTH} caracteres.`;

  const authors = splitList(values.authors);
  if (authors.length === 0) errors.authors = 'Introduce al menos un autor.';
  else if (authors.length > MAX_AUTHORS) errors.authors = `Máximo ${MAX_AUTHORS} autores.`;
  else if (authors.some((author) => author.length > MAX_AUTHOR_LENGTH)) {
    errors.authors = `Cada autor puede tener como máximo ${MAX_AUTHOR_LENGTH} caracteres.`;
  }

  let pageCount: number | undefined;
  const pageText = values.pageCount.trim();
  if (pageText) {
    pageCount = INTEGER.test(pageText) ? Number(pageText) : NaN;
    if (!(pageCount >= 1 && pageCount <= MAX_PAGE_COUNT)) {
      errors.pageCount = `Introduce un número entero de páginas entre 1 y ${MAX_PAGE_COUNT}.`;
      pageCount = undefined;
    }
  }

  const genres = splitList(values.genres);
  if (genres.length > MAX_GENRES) errors.genres = `Máximo ${MAX_GENRES} géneros.`;
  else if (genres.some((genre) => genre.length > MAX_GENRE_LENGTH)) {
    errors.genres = `Cada género puede tener como máximo ${MAX_GENRE_LENGTH} caracteres.`;
  }

  const seriesName = values.seriesName.trim().replace(/\s+/g, ' ');
  if (seriesName.length > MAX_SERIES_NAME_LENGTH) {
    errors.seriesName = `El nombre de la saga no puede superar ${MAX_SERIES_NAME_LENGTH} caracteres.`;
  }

  let seriesOrder: number | undefined;
  const orderText = values.seriesOrder.trim();
  if (orderText) {
    if (!seriesName) {
      errors.seriesOrder = 'Indica primero el nombre de la saga.';
    } else if (!INTEGER.test(orderText) || Number(orderText) > MAX_SERIES_ORDER) {
      errors.seriesOrder = `Introduce un número entero entre 0 y ${MAX_SERIES_ORDER}.`;
    } else {
      seriesOrder = Number(orderText);
    }
  }

  const status: ReadingStatus = acquisition === 'wishlist' ? DEFAULT_READING_STATUS : values.status;
  if (!READING_STATUSES.includes(status)) errors.status = 'Elige un estado de lectura válido.';

  // El ISBN es opcional; si se escribe, debe ser válido y se guarda normalizado a ISBN-13.
  let isbn13: string | undefined;
  if (values.isbn13.trim()) {
    const parsed = parseIsbn(values.isbn13);
    if (parsed.ok) isbn13 = parsed.isbn13;
    else errors.isbn13 = getIsbnErrorMessage(parsed.reason);
  }

  // La portada solo viene del catálogo: se acepta una URL https razonable y, si no, se descarta sin avisar.
  const coverUrl = values.coverUrl.trim();
  const validCover = coverUrl.startsWith('https://') && coverUrl.length <= MAX_COVER_URL_LENGTH;

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const data: NewBookFields = {
    title,
    authors,
    status,
    acquisition,
    // «Terminado» se define como leído al 100 %: con total de páginas conocido, la página actual es la última.
    currentPage: status === 'finished' && pageCount ? pageCount : 0,
  };
  if (pageCount !== undefined) data.pageCount = pageCount;
  if (genres.length > 0) data.genres = genres;
  if (seriesName) data.seriesName = seriesName;
  if (seriesOrder !== undefined) data.seriesOrder = seriesOrder;
  if (isbn13) data.isbn13 = isbn13;
  if (validCover) data.coverUrl = coverUrl;

  return { ok: true, data };
}

/** ¿Está en la lista de deseos (aún sin tenerlo)? Un libro sin el dato cuenta como propio. */
export function isWishlistBook(book: { acquisition?: Acquisition }): boolean {
  return book.acquisition === 'wishlist';
}

/** Lo mínimo que hay que saber de un libro para decidir qué cambia al mover su estado (sin depender de Firebase). */
export interface BookProgressState {
  status: ReadingStatus;
  currentPage: number;
  pageCount?: number;
  startedAt?: unknown;
  finishedAt?: unknown;
}

/** Cambios a aplicar al pasar un libro a otro estado de lectura. */
export interface StatusChange {
  status: ReadingStatus;
  /** Nueva página actual; undefined = no tocar. */
  currentPage?: number;
  setStartedAt: boolean;
  setFinishedAt: boolean;
  clearFinishedAt: boolean;
}

/**
 * Decide qué cambia al pasar `book` al estado `next`:
 * - «Terminado» = leído al 100 %: con total de páginas conocido, la página actual es la última; fija `finishedAt`.
 * - Empezar a leer, pausar o terminar fija `startedAt` si aún no existía.
 * - Salir de «Terminado» borra `finishedAt` (el libro se reabre) pero conserva el progreso y las sesiones.
 * - Si el estado no cambia, no hay cambios.
 */
export function planStatusChange(book: BookProgressState, next: ReadingStatus): StatusChange {
  const change: StatusChange = { status: next, setStartedAt: false, setFinishedAt: false, clearFinishedAt: false };
  if (book.status === next) return change;

  if (next === 'reading' || next === 'paused' || next === 'finished') {
    change.setStartedAt = !book.startedAt;
  }
  if (next === 'finished') {
    change.setFinishedAt = true;
    if (book.pageCount && book.currentPage !== book.pageCount) change.currentPage = book.pageCount;
  } else if (book.finishedAt) {
    change.clearFinishedAt = true;
  }
  return change;
}

/**
 * Al editar el total de páginas hay que mantener coherente el progreso:
 * un libro terminado queda en la última página y ningún libro puede estar más allá del final.
 * Devuelve la nueva página actual, o undefined si no hay que cambiarla.
 */
export function getProgressAfterPageCountChange(
  book: Pick<BookProgressState, 'status' | 'currentPage'>,
  pageCount: number | undefined,
): number | undefined {
  if (pageCount === undefined) return undefined;
  if (book.status === 'finished') return book.currentPage !== pageCount ? pageCount : undefined;
  return book.currentPage > pageCount ? pageCount : undefined;
}

/** Porcentaje leído (0–100, entero) o undefined si no se conoce el total de páginas. */
export function getProgressPercent(book: Pick<BookProgressState, 'currentPage' | 'pageCount'>): number | undefined {
  if (!book.pageCount) return undefined;
  const percent = Math.round((book.currentPage / book.pageCount) * 100);
  return Math.min(100, Math.max(0, percent));
}

/** «1 libro», «5 libros». */
export function formatBookCount(count: number): string {
  return `${count} ${count === 1 ? 'libro' : 'libros'}`;
}

/** Convierte un libro guardado en los valores del formulario, para editarlo. */
export function bookToFormValues(
  book: Pick<UserBook, 'title' | 'authors' | 'status'> &
    Partial<Pick<UserBook, 'pageCount' | 'genres' | 'seriesName' | 'seriesOrder' | 'isbn13' | 'coverUrl'>>,
): BookFormValues {
  return {
    isbn13: book.isbn13 ?? '',
    coverUrl: book.coverUrl ?? '',
    title: book.title,
    authors: book.authors.join(', '),
    pageCount: book.pageCount !== undefined ? String(book.pageCount) : '',
    genres: (book.genres ?? []).join(', '),
    seriesName: book.seriesName ?? '',
    seriesOrder: book.seriesOrder !== undefined ? String(book.seriesOrder) : '',
    status: book.status,
  };
}

/** «5 libros», o «2 de 5 libros» cuando hay una búsqueda o filtros que ocultan parte de la biblioteca. */
export function formatFilteredBookCount(shown: number, total: number): string {
  return shown === total ? formatBookCount(total) : `${shown} de ${formatBookCount(total)}`;
}
