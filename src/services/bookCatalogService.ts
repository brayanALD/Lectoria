import type { CatalogBook } from '../types/book';
import { MAX_AUTHORS, MAX_AUTHOR_LENGTH, MAX_COVER_URL_LENGTH, MAX_PAGE_COUNT, MAX_TITLE_LENGTH } from '../utils/book';

// Proveedor: Open Library (https://openlibrary.org/developers/api). No requiere clave. Su política pide identificar la
// app con un User-Agent, no superar 1 petición por segundo y no usarla como servidor de un servicio comercial de
// mucho tráfico. Aquí solo se consulta cuando la persona pulsa «Buscar» (una petición por ISBN y por teléfono).
// Las pantallas no conocen al proveedor: si hubiera que cambiarlo, solo cambia este archivo.
const ENDPOINT = 'https://openlibrary.org/api/books';
const REQUEST_TIMEOUT_MS = 8000;

export const CATALOG_UNAVAILABLE = 'lectoria/catalog-unavailable';
export const CATALOG_RATE_LIMITED = 'lectoria/catalog-rate-limited';

function coded(code: string): Error & { code: string } {
  return Object.assign(new Error(code), { code });
}

interface OpenLibraryAuthor {
  name?: unknown;
}

interface OpenLibraryBook {
  title?: unknown;
  subtitle?: unknown;
  authors?: unknown;
  number_of_pages?: unknown;
  cover?: { small?: unknown; medium?: unknown; large?: unknown };
}

const isText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

/**
 * Convierte la respuesta de Open Library (`jscmd=data`) en un `CatalogBook`.
 * Devuelve null si el ISBN no está en el catálogo (respuesta vacía) o si no trae ni título ni autores utilizables.
 * Descarta los datos fuera de los límites que aceptan las reglas de Firestore en lugar de fallar.
 */
export function parseOpenLibraryResponse(payload: unknown, isbn13: string): CatalogBook | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const entry = (payload as Record<string, unknown>)[`ISBN:${isbn13}`] as OpenLibraryBook | undefined;
  if (!entry || typeof entry !== 'object') return null;
  if (!isText(entry.title)) return null;

  const subtitle = isText(entry.subtitle) ? `: ${entry.subtitle.trim()}` : '';
  const title = `${entry.title.trim()}${subtitle}`.slice(0, MAX_TITLE_LENGTH);

  const authors = (Array.isArray(entry.authors) ? (entry.authors as OpenLibraryAuthor[]) : [])
    .map((author) => (isText(author?.name) ? author.name.trim() : ''))
    .filter((name) => name.length > 0 && name.length <= MAX_AUTHOR_LENGTH)
    .slice(0, MAX_AUTHORS);

  const pages = entry.number_of_pages;
  const pageCount =
    typeof pages === 'number' && Number.isInteger(pages) && pages >= 1 && pages <= MAX_PAGE_COUNT ? pages : undefined;

  const cover = [entry.cover?.medium, entry.cover?.large, entry.cover?.small].find(
    (url): url is string => isText(url) && url.startsWith('https://') && url.length <= MAX_COVER_URL_LENGTH,
  );

  const book: CatalogBook = { isbn13, title, authors };
  if (pageCount !== undefined) book.pageCount = pageCount;
  if (cover) book.coverUrl = cover;
  return book;
}

interface FindOptions {
  /** Permite probar el servicio sin red. */
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

/**
 * Busca un libro por su ISBN-13 (ya validado). Devuelve null si el catálogo no lo conoce.
 * Lanza un error con código `lectoria/catalog-unavailable` (sin red, tiempo agotado o error del servidor) o
 * `lectoria/catalog-rate-limited` (demasiadas consultas seguidas).
 */
export async function findBookByIsbn(isbn13: string, options: FindOptions = {}): Promise<CatalogBook | null> {
  const { fetchFn = fetch, timeoutMs = REQUEST_TIMEOUT_MS } = options;
  const contact = process.env.EXPO_PUBLIC_OPENLIBRARY_CONTACT;
  const url = `${ENDPOINT}?bibkeys=ISBN:${isbn13}&jscmd=data&format=json`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchFn(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json', 'User-Agent': contact ? `Lectoria (${contact})` : 'Lectoria' },
    });
    if (response.status === 429) throw coded(CATALOG_RATE_LIMITED);
    if (!response.ok) throw coded(CATALOG_UNAVAILABLE);
    return parseOpenLibraryResponse(await response.json(), isbn13);
  } catch (error) {
    // Los errores propios se reenvían tal cual; el resto (sin conexión, tiempo agotado, JSON ilegible) pasa a
    // «no disponible». Ojo: AbortError también trae un `code` (numérico), por eso se comprueba el prefijo.
    const code = typeof error === 'object' && error !== null && 'code' in error ? (error as { code: unknown }).code : '';
    if (typeof code === 'string' && code.startsWith('lectoria/')) throw error;
    throw coded(CATALOG_UNAVAILABLE);
  } finally {
    clearTimeout(timer);
  }
}
