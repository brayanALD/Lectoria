import type {
  BookFormErrors,
  BookFormResult,
  BookFormValues,
  NewBookFields,
  ReadingStatus,
} from '../types/book';

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

export const EMPTY_BOOK_FORM: BookFormValues = {
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
 * Un libro nuevo siempre entra a la biblioteca (`owned`); la lista de deseos llega en la versión 1.1.
 */
export function parseBookForm(values: BookFormValues): BookFormResult {
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

  if (!READING_STATUSES.includes(values.status)) errors.status = 'Elige un estado de lectura válido.';

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const data: NewBookFields = {
    title,
    authors,
    status: values.status,
    acquisition: 'owned',
    // «Terminado» se define como leído al 100 %: con total de páginas conocido, la página actual es la última.
    currentPage: values.status === 'finished' && pageCount ? pageCount : 0,
  };
  if (pageCount !== undefined) data.pageCount = pageCount;
  if (genres.length > 0) data.genres = genres;
  if (seriesName) data.seriesName = seriesName;
  if (seriesOrder !== undefined) data.seriesOrder = seriesOrder;

  return { ok: true, data };
}
