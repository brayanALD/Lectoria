import type { CatalogBook } from '../../../src/types/book';
import {
  MAX_AUTHORS,
  MAX_AUTHOR_LENGTH,
  MAX_COVER_URL_LENGTH,
  MAX_PAGE_COUNT,
  MAX_TITLE_LENGTH,
} from '../../../src/utils/book';
import { getIsbnErrorMessage, parseIsbn } from '../../../src/utils/isbn';
import type { Ctx } from '../context';
import { ApiError, validation } from '../errors';

// Proveedor principal: Open Library (https://openlibrary.org/developers/api). No requiere clave. Su política pide
// identificar la app con un User-Agent y no superar 1 petición por segundo (3 si se identifica con un contacto).
// Respaldo: Google Books, SOLO si Open Library no encuentra el ISBN (o no responde) y hay una clave configurada en el
// servidor. Es «lo mejor posible»: si falla, no cambia el resultado. Ver docs/diagnostico-busqueda-isbn.md.
// Las pantallas no conocen a los proveedores: si hubiera que cambiarlos, solo cambia este archivo.
const OPEN_LIBRARY = 'https://openlibrary.org/api/books';
const GOOGLE_BOOKS = 'https://www.googleapis.com/books/v1/volumes';
const REQUEST_TIMEOUT_MS = 8000;
// Google Books respondió 503 en torno a la mitad de las consultas en las pruebas: se reintenta una vez, enseguida.
const GOOGLE_TIMEOUT_MS = 5000;
const GOOGLE_RETRY_DELAY_MS = 400;
const GOOGLE_ATTEMPTS = 2;

/** Un ISBN encontrado se recuerda un día; uno no encontrado, diez minutos (un catálogo puede añadirlo). Los fallos no se recuerdan. */
const FOUND_TTL_MS = 24 * 3600_000;
const MISSING_TTL_MS = 10 * 60_000;
const MAX_CACHE_ENTRIES = 2000;

const isText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

interface OpenLibraryEntry {
  title?: unknown;
  subtitle?: unknown;
  authors?: unknown;
  number_of_pages?: unknown;
  cover?: { small?: unknown; medium?: unknown; large?: unknown };
}

/**
 * Convierte la respuesta de Open Library (`jscmd=data`) en un `CatalogBook`. Devuelve null si el ISBN no está en el
 * catálogo o no trae ni título ni autores utilizables. Descarta los datos fuera de los límites del libro.
 */
export function parseOpenLibraryResponse(payload: unknown, isbn13: string): CatalogBook | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const entry = (payload as Record<string, unknown>)[`ISBN:${isbn13}`] as OpenLibraryEntry | undefined;
  if (!entry || typeof entry !== 'object' || !isText(entry.title)) return null;

  const subtitle = isText(entry.subtitle) ? `: ${entry.subtitle.trim()}` : '';
  const title = `${entry.title.trim()}${subtitle}`.slice(0, MAX_TITLE_LENGTH);
  const authors = (Array.isArray(entry.authors) ? (entry.authors as { name?: unknown }[]) : [])
    .map((author) => (isText(author?.name) ? author.name.trim() : ''))
    .filter((name) => name.length > 0 && name.length <= MAX_AUTHOR_LENGTH)
    .slice(0, MAX_AUTHORS);
  const pages = entry.number_of_pages;
  const pageCount = typeof pages === 'number' && Number.isInteger(pages) && pages >= 1 && pages <= MAX_PAGE_COUNT ? pages : undefined;
  const cover = [entry.cover?.medium, entry.cover?.large, entry.cover?.small].find(
    (url): url is string => isText(url) && url.startsWith('https://') && url.length <= MAX_COVER_URL_LENGTH,
  );

  const book: CatalogBook = { isbn13, title, authors };
  if (pageCount !== undefined) book.pageCount = pageCount;
  if (cover) book.coverUrl = cover;
  return book;
}

interface GoogleVolume {
  volumeInfo?: {
    title?: unknown;
    subtitle?: unknown;
    authors?: unknown;
    pageCount?: unknown;
    industryIdentifiers?: unknown;
    imageLinks?: { thumbnail?: unknown; smallThumbnail?: unknown };
  };
}

/** Portada de Google Books: llega como `http://` y con una esquina doblada (`edge=curl`); se pasa a https y se limpia. */
function toSecureCover(url: unknown): string | undefined {
  if (!isText(url)) return undefined;
  const secure = url.trim().replace(/^http:\/\//, 'https://').replace('&edge=curl', '');
  return secure.startsWith('https://') && secure.length <= MAX_COVER_URL_LENGTH ? secure : undefined;
}

/**
 * Convierte la respuesta de Google Books (`volumes?q=isbn:…`) en un `CatalogBook`. Solo acepta un volumen que declare ese
 * mismo ISBN-13: rellenar el formulario con un libro equivocado es peor que no encontrarlo.
 */
export function parseGoogleBooksResponse(payload: unknown, isbn13: string): CatalogBook | null {
  const items = typeof payload === 'object' && payload !== null ? (payload as { items?: unknown }).items : undefined;
  if (!Array.isArray(items)) return null;

  const volume = (items as GoogleVolume[]).find((item) => {
    const identifiers = item?.volumeInfo?.industryIdentifiers;
    return (
      Array.isArray(identifiers) &&
      identifiers.some(
        (id: { type?: unknown; identifier?: unknown }) =>
          id?.type === 'ISBN_13' && typeof id.identifier === 'string' && id.identifier.replace(/-/g, '') === isbn13,
      ) &&
      isText(item.volumeInfo?.title)
    );
  });
  const info = volume?.volumeInfo;
  if (!info || !isText(info.title)) return null;

  const subtitle = isText(info.subtitle) ? `: ${info.subtitle.trim()}` : '';
  const title = `${info.title.trim()}${subtitle}`.slice(0, MAX_TITLE_LENGTH);
  const authors = (Array.isArray(info.authors) ? (info.authors as unknown[]) : [])
    .map((name) => (isText(name) ? name.trim() : ''))
    .filter((name) => name.length > 0 && name.length <= MAX_AUTHOR_LENGTH)
    .slice(0, MAX_AUTHORS);
  const pages = info.pageCount;
  const pageCount = typeof pages === 'number' && Number.isInteger(pages) && pages >= 1 && pages <= MAX_PAGE_COUNT ? pages : undefined;
  const cover = toSecureCover(info.imageLinks?.thumbnail) ?? toSecureCover(info.imageLinks?.smallThumbnail);

  const book: CatalogBook = { isbn13, title, authors };
  if (pageCount !== undefined) book.pageCount = pageCount;
  if (cover) book.coverUrl = cover;
  return book;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

class CatalogUnavailable extends Error {}
class CatalogRateLimited extends Error {}

/** Un GET con tiempo máximo. Devuelve el estado y, si fue correcto, el JSON; sin red, tiempo agotado o JSON ilegible → «no disponible». */
async function getJson(
  ctx: Ctx,
  url: string,
  headers: Record<string, string>,
  timeoutMs: number,
): Promise<{ status: number; json?: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await ctx.fetchFn(url, { signal: controller.signal, headers });
    return response.ok ? { status: response.status, json: await response.json() } : { status: response.status };
  } catch {
    throw new CatalogUnavailable();
  } finally {
    clearTimeout(timer);
  }
}

/** Open Library. Null si no conoce el ISBN; lanza si no responde o si hay demasiadas consultas. */
async function findInOpenLibrary(ctx: Ctx, isbn13: string): Promise<CatalogBook | null> {
  const contact = ctx.config.openLibraryContact;
  const { status, json } = await getJson(
    ctx,
    `${OPEN_LIBRARY}?bibkeys=ISBN:${isbn13}&jscmd=data&format=json`,
    { Accept: 'application/json', 'User-Agent': contact ? `Lectoria (${contact})` : 'Lectoria' },
    REQUEST_TIMEOUT_MS,
  );
  if (status === 429) throw new CatalogRateLimited();
  if (status < 200 || status >= 300) throw new CatalogUnavailable();
  return parseOpenLibraryResponse(json, isbn13);
}

/** Google Books, como respaldo y siempre «lo mejor posible»: null si no hay clave, no lo encuentra o falla (nunca lanza). */
async function findInGoogleBooks(ctx: Ctx, isbn13: string): Promise<CatalogBook | null> {
  const key = ctx.config.googleBooksKey;
  if (!key) return null;
  const fields = 'items(volumeInfo(title,subtitle,authors,pageCount,industryIdentifiers,imageLinks))';
  const url = `${GOOGLE_BOOKS}?q=isbn:${isbn13}&maxResults=5&fields=${encodeURIComponent(fields)}&key=${encodeURIComponent(key)}`;

  for (let attempt = 1; attempt <= GOOGLE_ATTEMPTS; attempt++) {
    try {
      const { status, json } = await getJson(ctx, url, { Accept: 'application/json' }, GOOGLE_TIMEOUT_MS);
      if (status >= 200 && status < 300) return parseGoogleBooksResponse(json, isbn13);
      if (status < 500) return null; // clave rechazada, cuota agotada…: reintentar no ayuda
    } catch {
      // sin red o tiempo agotado: se trata como un fallo del servidor
    }
    if (attempt < GOOGLE_ATTEMPTS) await sleep(GOOGLE_RETRY_DELAY_MS);
  }
  return null;
}

const cache = new Map<string, { book: CatalogBook | null; expires: number }>();

/** Solo para las pruebas. */
export function clearCatalogCache(): void {
  cache.clear();
}

/**
 * Busca un libro por su ISBN (10 o 13, con o sin guiones). Responde `{ book }`, con `book: null` si ningún catálogo lo
 * conoce. Consulta Open Library y, si no lo encuentra o no responde, Google Books (si hay clave). Los resultados se
 * recuerdan para no repetir consultas al catálogo, que comparte una misma dirección para todos los usuarios.
 */
export async function findBookByIsbn(ctx: Ctx, rawIsbn: string): Promise<{ book: CatalogBook | null }> {
  const parsed = parseIsbn(rawIsbn);
  if (!parsed.ok) throw validation({ isbn: getIsbnErrorMessage(parsed.reason) });
  const isbn13 = parsed.isbn13;

  const now = ctx.now().getTime();
  const cached = cache.get(isbn13);
  if (cached && cached.expires > now) return { book: cached.book };

  let primaryError: unknown;
  let book: CatalogBook | null = null;
  try {
    book = await findInOpenLibrary(ctx, isbn13);
  } catch (error) {
    primaryError = error;
  }
  if (!book) book = await findInGoogleBooks(ctx, isbn13);

  if (!book && primaryError) {
    if (primaryError instanceof CatalogRateLimited) {
      throw new ApiError(429, 'CATALOG_RATE_LIMITED', 'Demasiadas consultas seguidas. Espera un momento e inténtalo de nuevo.');
    }
    throw new ApiError(502, 'CATALOG_UNAVAILABLE', 'No se pudo consultar el catálogo.');
  }

  if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value as string);
  cache.set(isbn13, { book, expires: now + (book ? FOUND_TTL_MS : MISSING_TTL_MS) });
  return { book };
}
