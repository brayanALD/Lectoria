import type { Acquisition, NewBookFields, ReadingStatus } from '../../src/types/book';
import {
  MAX_AUTHORS,
  MAX_AUTHOR_LENGTH,
  MAX_COVER_URL_LENGTH,
  MAX_GENRES,
  MAX_GENRE_LENGTH,
  MAX_PAGE_COUNT,
  MAX_SERIES_NAME_LENGTH,
  MAX_SERIES_ORDER,
  MAX_TITLE_LENGTH,
  READING_STATUSES,
  planStatusChange,
} from '../../src/utils/book';
import { getIsbnErrorMessage, parseIsbn } from '../../src/utils/isbn';
import { validation } from './errors';

/** Identificador que elige el cliente para que repetir una creación no la duplique (ver `requestId`). */
export const REQUEST_ID = /^[A-Za-z0-9_-]{8,100}$/;

/** Un objeto JSON; cualquier otra cosa (lista, texto, nulo) es una solicitud mal formada. */
export function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw validation({ body: 'El cuerpo de la solicitud debe ser un objeto JSON.' });
  }
  return value as Record<string, unknown>;
}

/**
 * Lector de campos que junta los errores de todos los campos antes de fallar, para que el cliente reciba la lista
 * completa de una vez (`fields`) en lugar de corregir de uno en uno.
 */
export class Reader {
  readonly fields: Record<string, string> = {};
  constructor(readonly data: Record<string, unknown>) {}

  fail(key: string, message: string): undefined {
    this.fields[key] ??= message;
    return undefined;
  }

  /** Lanza el error de validación si algún campo falló. */
  done(): void {
    if (Object.keys(this.fields).length > 0) throw validation(this.fields);
  }

  has(key: string): boolean {
    return this.data[key] !== undefined && this.data[key] !== null;
  }

  string(key: string, options: { required?: boolean; max?: number } = {}): string | undefined {
    const value = this.data[key];
    if (value === undefined || value === null) {
      if (options.required) this.fail(key, 'Este campo es obligatorio.');
      return undefined;
    }
    if (typeof value !== 'string') return this.fail(key, 'Debe ser un texto.');
    if (options.max !== undefined && value.length > options.max) {
      return this.fail(key, `No puede superar ${options.max} caracteres.`);
    }
    return value;
  }

  integer(key: string, options: { required?: boolean; min?: number; max?: number } = {}): number | undefined {
    const value = this.data[key];
    if (value === undefined || value === null) {
      if (options.required) this.fail(key, 'Este campo es obligatorio.');
      return undefined;
    }
    if (typeof value !== 'number' || !Number.isInteger(value)) return this.fail(key, 'Debe ser un número entero.');
    if ((options.min !== undefined && value < options.min) || (options.max !== undefined && value > options.max)) {
      return this.fail(key, `Debe estar entre ${options.min ?? '-∞'} y ${options.max ?? '∞'}.`);
    }
    return value;
  }

  number(key: string, options: { required?: boolean; min?: number; max?: number } = {}): number | undefined {
    const value = this.data[key];
    if (value === undefined || value === null) {
      if (options.required) this.fail(key, 'Este campo es obligatorio.');
      return undefined;
    }
    if (typeof value !== 'number' || !Number.isFinite(value)) return this.fail(key, 'Debe ser un número.');
    if ((options.min !== undefined && value < options.min) || (options.max !== undefined && value > options.max)) {
      return this.fail(key, `Debe estar entre ${options.min ?? '-∞'} y ${options.max ?? '∞'}.`);
    }
    return value;
  }

  /** Una fecha en ISO 8601 («2026-10-13T12:00:00.000Z»). */
  date(key: string, options: { required?: boolean } = {}): Date | undefined {
    const text = this.string(key, { required: options.required, max: 40 });
    if (text === undefined) return undefined;
    const date = new Date(text);
    if (!/^\d{4}-\d{2}-\d{2}T/.test(text) || Number.isNaN(date.getTime())) {
      return this.fail(key, 'Debe ser una fecha en formato ISO 8601.');
    }
    return date;
  }

  /** Una zona horaria IANA («America/Bogota»). */
  timeZone(key = 'timeZone'): string | undefined {
    const zone = this.string(key, { required: true, max: 64 });
    if (zone === undefined) return undefined;
    if (!isValidTimeZone(zone)) return this.fail(key, 'Debe ser una zona horaria válida.');
    return zone;
  }

  requestId(key = 'requestId'): string | undefined {
    const id = this.string(key, { max: 100 });
    if (id !== undefined && !REQUEST_ID.test(id)) {
      return this.fail(key, 'Debe tener entre 8 y 100 caracteres (letras, números, «-» o «_»).');
    }
    return id;
  }

  /** Una lista de textos, recortados, sin vacíos ni repetidos (sin distinguir mayúsculas). */
  stringList(key: string, options: { maxItems: number; maxLength: number }): string[] | undefined {
    const value = this.data[key];
    if (value === undefined || value === null) return undefined;
    if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
      return this.fail(key, 'Debe ser una lista de textos.');
    }
    const seen = new Set<string>();
    const items: string[] = [];
    for (const raw of value as string[]) {
      const item = raw.trim().replace(/\s+/g, ' ');
      const lower = item.toLowerCase();
      if (item && !seen.has(lower)) {
        seen.add(lower);
        items.push(item);
      }
    }
    if (items.length > options.maxItems) return this.fail(key, `Máximo ${options.maxItems}.`);
    if (items.some((item) => item.length > options.maxLength)) {
      return this.fail(key, `Cada elemento puede tener como máximo ${options.maxLength} caracteres.`);
    }
    return items;
  }
}

export function isValidTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

export interface BookInput {
  requestId?: string;
  data: NewBookFields;
}

/**
 * Valida los datos de un libro (los mismos límites y reglas que `parseBookForm` del formulario, que es lo que la app
 * ya comprobó) y devuelve los campos que se guardan. El servidor no se fía del formulario: lo vuelve a comprobar.
 * - Un deseo (`wishlist`) siempre entra como «Quiero leerlo» y en la página 0.
 * - «Terminado» con total de páginas conocido deja el libro en la última página.
 * - La portada solo se acepta si es una URL `https` razonable; si no, se descarta sin avisar (como en el formulario).
 */
export function validateBookInput(raw: unknown): BookInput {
  const r = new Reader(asRecord(raw));
  const requestId = r.requestId();

  const rawTitle = r.string('title', { required: true });
  const title = rawTitle?.trim().replace(/\s+/g, ' ');
  if (rawTitle !== undefined && !title) r.fail('title', 'Introduce el título.');
  else if (title && title.length > MAX_TITLE_LENGTH) r.fail('title', `No puede superar ${MAX_TITLE_LENGTH} caracteres.`);

  const authors = r.stringList('authors', { maxItems: MAX_AUTHORS, maxLength: MAX_AUTHOR_LENGTH });
  if (authors !== undefined && authors.length === 0) r.fail('authors', 'Introduce al menos un autor.');
  else if (authors === undefined && !r.fields.authors) r.fail('authors', 'Este campo es obligatorio.');

  const pageCount = r.integer('pageCount', { min: 1, max: MAX_PAGE_COUNT });
  const genres = r.stringList('genres', { maxItems: MAX_GENRES, maxLength: MAX_GENRE_LENGTH });

  const seriesName = r.string('seriesName', { max: MAX_SERIES_NAME_LENGTH * 2 })?.trim().replace(/\s+/g, ' ');
  if (seriesName && seriesName.length > MAX_SERIES_NAME_LENGTH) {
    r.fail('seriesName', `No puede superar ${MAX_SERIES_NAME_LENGTH} caracteres.`);
  }
  const seriesOrder = r.integer('seriesOrder', { min: 0, max: MAX_SERIES_ORDER });
  if (seriesOrder !== undefined && !seriesName) r.fail('seriesOrder', 'Indica primero el nombre de la saga.');

  const acquisitionRaw = r.string('acquisition');
  let acquisition: Acquisition = 'owned';
  if (acquisitionRaw !== undefined) {
    if (acquisitionRaw === 'owned' || acquisitionRaw === 'wishlist') acquisition = acquisitionRaw;
    else r.fail('acquisition', 'Debe ser «owned» o «wishlist».');
  }

  const statusRaw = r.string('status');
  let status: ReadingStatus = 'want_to_read';
  if (statusRaw !== undefined) {
    if ((READING_STATUSES as readonly string[]).includes(statusRaw)) status = statusRaw as ReadingStatus;
    else r.fail('status', 'Elige un estado de lectura válido.');
  }
  if (acquisition === 'wishlist') status = 'want_to_read';

  let isbn13: string | undefined;
  const isbnText = r.string('isbn13', { max: 40 });
  if (isbnText?.trim()) {
    const parsed = parseIsbn(isbnText);
    if (parsed.ok) isbn13 = parsed.isbn13;
    else r.fail('isbn13', getIsbnErrorMessage(parsed.reason));
  }

  const coverText = r.string('coverUrl')?.trim();
  const coverUrl = coverText && coverText.startsWith('https://') && coverText.length <= MAX_COVER_URL_LENGTH ? coverText : undefined;

  r.done();

  const data: NewBookFields = {
    title: title as string,
    authors: authors as string[],
    status,
    acquisition,
    currentPage: status === 'finished' && pageCount ? pageCount : 0,
  };
  if (pageCount !== undefined) data.pageCount = pageCount;
  if (genres && genres.length > 0) data.genres = genres;
  if (seriesName) data.seriesName = seriesName;
  if (seriesOrder !== undefined) data.seriesOrder = seriesOrder;
  if (isbn13) data.isbn13 = isbn13;
  if (coverUrl) data.coverUrl = coverUrl;
  return { requestId, data };
}

/** Qué cambia al crear un libro con ese estado inicial (fechas de inicio y fin). */
export function planNewBook(data: NewBookFields) {
  return planStatusChange({ status: 'want_to_read', currentPage: 0, pageCount: data.pageCount }, data.status);
}
