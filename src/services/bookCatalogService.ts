import { Platform } from 'react-native';

import type { CatalogBook } from '../types/book';
import { MAX_AUTHORS, MAX_AUTHOR_LENGTH, MAX_COVER_URL_LENGTH, MAX_PAGE_COUNT, MAX_TITLE_LENGTH } from '../utils/book';

// Proveedor principal: Open Library (https://openlibrary.org/developers/api). No requiere clave. Su política pide
// identificar la app con un User-Agent, no superar 1 petición por segundo y no usarla como servidor de un servicio
// comercial de mucho tráfico. Aquí solo se consulta cuando la persona pulsa «Buscar» (una petición por ISBN y por teléfono).
// Respaldo: Google Books, SOLO si Open Library no encuentra el ISBN (o no responde) y hay una clave configurada. Es
// «lo mejor posible»: si falla, no cambia el resultado. Ver docs/diagnostico-busqueda-isbn.md.
// Las pantallas no conocen a los proveedores: si hubiera que cambiarlos, solo cambia este archivo.
const ENDPOINT = 'https://openlibrary.org/api/books';
const GOOGLE_BOOKS_ENDPOINT = 'https://www.googleapis.com/books/v1/volumes';
const REQUEST_TIMEOUT_MS = 8000;
// Google Books respondió 503 en torno a la mitad de las consultas en las pruebas: se reintenta una vez, enseguida.
const GOOGLE_BOOKS_TIMEOUT_MS = 5000;
const GOOGLE_BOOKS_RETRY_DELAY_MS = 400;
const GOOGLE_BOOKS_ATTEMPTS = 2;
// Identificador de la app que Google comprueba cuando la clave está restringida a la app Android (ver CLAUDE.md).
const ANDROID_PACKAGE = 'com.lectoria.app';

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
 * Convierte la respuesta de Google Books (`volumes?q=isbn:…`) en un `CatalogBook`. Solo acepta un volumen que
 * declare ese mismo ISBN-13: una consulta de texto libre devolvió libros sin relación en las pruebas, y rellenar el
 * formulario con un libro equivocado es peor que no encontrarlo. Devuelve null si no hay ninguno.
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
  const pageCount =
    typeof pages === 'number' && Number.isInteger(pages) && pages >= 1 && pages <= MAX_PAGE_COUNT ? pages : undefined;
  const cover = toSecureCover(info.imageLinks?.thumbnail) ?? toSecureCover(info.imageLinks?.smallThumbnail);

  const book: CatalogBook = { isbn13, title, authors };
  if (pageCount !== undefined) book.pageCount = pageCount;
  if (cover) book.coverUrl = cover;
  return book;
}

/**
 * Cabeceras que identifican a la app ante Google cuando la clave está restringida a Android (el `fetch` de JavaScript
 * no las envía solo, a diferencia de los SDK nativos). Sin huella configurada o en otra plataforma, ninguna.
 */
export function getGoogleBooksHeaders(os: string, androidCertSha1?: string): Record<string, string> {
  const cert = androidCertSha1?.replace(/[^0-9a-f]/gi, '').toUpperCase();
  if (os !== 'android' || !cert) return {};
  return { 'X-Android-Package': ANDROID_PACKAGE, 'X-Android-Cert': cert };
}

interface FindOptions {
  /** Permite probar el servicio sin red. */
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  /**
   * Clave de Google Books. Si no se indica se toma de `EXPO_PUBLIC_GOOGLE_BOOKS_API_KEY`; sin clave (o con `null`) no hay
   * respaldo y solo se consulta Open Library.
   */
  googleBooksKey?: string | null;
  /** Huella SHA-1 del certificado de la app (Android); por defecto, `EXPO_PUBLIC_ANDROID_CERT_SHA1`. */
  androidCertSha1?: string;
  /** Sistema operativo para las cabeceras de la clave; por defecto, el del dispositivo. */
  platformOs?: string;
  retryDelayMs?: number;
}

/** Traza solo en desarrollo (no en producción ni en las pruebas): sirve para ver en el dispositivo qué respondió cada proveedor. */
function debug(message: string): void {
  if (__DEV__ && process.env.NODE_ENV !== 'test') console.log(`[catálogo] ${message}`);
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Un GET con tiempo máximo. Devuelve el estado y, si fue correcto, el JSON; sin red, tiempo agotado o JSON ilegible → «no disponible». */
async function getJson(
  url: string,
  headers: Record<string, string>,
  { fetchFn = fetch, timeoutMs = REQUEST_TIMEOUT_MS }: Pick<FindOptions, 'fetchFn' | 'timeoutMs'>,
): Promise<{ status: number; json?: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchFn(url, { signal: controller.signal, headers });
    return response.ok ? { status: response.status, json: await response.json() } : { status: response.status };
  } catch {
    throw coded(CATALOG_UNAVAILABLE);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Open Library. Devuelve null si no conoce el ISBN. Lanza `lectoria/catalog-unavailable` (sin red, tiempo agotado o
 * error del servidor) o `lectoria/catalog-rate-limited` (demasiadas consultas seguidas).
 */
async function findInOpenLibrary(isbn13: string, options: FindOptions): Promise<CatalogBook | null> {
  const contact = process.env.EXPO_PUBLIC_OPENLIBRARY_CONTACT;
  const url = `${ENDPOINT}?bibkeys=ISBN:${isbn13}&jscmd=data&format=json`;
  const { status, json } = await getJson(
    url,
    { Accept: 'application/json', 'User-Agent': contact ? `Lectoria (${contact})` : 'Lectoria' },
    options,
  );
  if (status === 429) throw coded(CATALOG_RATE_LIMITED);
  if (status < 200 || status >= 300) throw coded(CATALOG_UNAVAILABLE);
  return parseOpenLibraryResponse(json, isbn13);
}

/**
 * Google Books, como respaldo. Siempre «lo mejor posible»: devuelve null si no hay clave, si no lo encuentra o si falla
 * (nunca lanza). Solo usa la consulta `isbn:` y descarta cualquier volumen que no declare ese ISBN-13. Reintenta una vez
 * ante un error del servidor, porque devolvió 503 en torno a la mitad de las consultas en las pruebas.
 */
async function findInGoogleBooks(isbn13: string, options: FindOptions): Promise<CatalogBook | null> {
  const key = options.googleBooksKey === undefined ? process.env.EXPO_PUBLIC_GOOGLE_BOOKS_API_KEY : options.googleBooksKey;
  if (!key) return null;

  const fields = 'items(volumeInfo(title,subtitle,authors,pageCount,industryIdentifiers,imageLinks))';
  const url = `${GOOGLE_BOOKS_ENDPOINT}?q=isbn:${isbn13}&maxResults=5&fields=${encodeURIComponent(fields)}&key=${encodeURIComponent(key)}`;
  const headers = {
    Accept: 'application/json',
    ...getGoogleBooksHeaders(
      options.platformOs ?? Platform.OS,
      options.androidCertSha1 ?? process.env.EXPO_PUBLIC_ANDROID_CERT_SHA1,
    ),
  };

  for (let attempt = 1; attempt <= GOOGLE_BOOKS_ATTEMPTS; attempt++) {
    try {
      const { status, json } = await getJson(url, headers, { ...options, timeoutMs: GOOGLE_BOOKS_TIMEOUT_MS });
      debug(`Google Books, intento ${attempt}: HTTP ${status}`);
      if (status >= 200 && status < 300) return parseGoogleBooksResponse(json, isbn13);
      if (status < 500) return null; // clave rechazada, cuota agotada…: reintentar no ayuda
    } catch {
      // sin red o tiempo agotado: se trata como un fallo del servidor
      debug(`Google Books, intento ${attempt}: sin respuesta`);
    }
    if (attempt < GOOGLE_BOOKS_ATTEMPTS) await sleep(options.retryDelayMs ?? GOOGLE_BOOKS_RETRY_DELAY_MS);
  }
  return null;
}

/**
 * Busca un libro por su ISBN-13 (ya validado). Devuelve null si ningún catálogo lo conoce.
 * Consulta Open Library y, si no lo encuentra o no responde, Google Books (si hay clave). Si Open Library falla y el
 * respaldo tampoco lo encuentra, lanza el error de Open Library: `lectoria/catalog-unavailable` (sin red, tiempo
 * agotado o error del servidor) o `lectoria/catalog-rate-limited` (demasiadas consultas seguidas).
 */
export async function findBookByIsbn(isbn13: string, options: FindOptions = {}): Promise<CatalogBook | null> {
  let primaryError: unknown;
  try {
    const book = await findInOpenLibrary(isbn13, options);
    debug(`Open Library: ${book ? 'encontrado' : 'no encontrado'}`);
    if (book) return book;
  } catch (error) {
    // Los errores propios se reenvían tal cual; el resto pasa a «no disponible». Ojo: AbortError también trae un
    // `code` (numérico), por eso se comprueba el prefijo.
    const code = typeof error === 'object' && error !== null && 'code' in error ? (error as { code: unknown }).code : '';
    primaryError = typeof code === 'string' && code.startsWith('lectoria/') ? error : coded(CATALOG_UNAVAILABLE);
    debug(`Open Library falló: ${String((primaryError as { code: unknown }).code)}`);
  }

  const fallback = await findInGoogleBooks(isbn13, options);
  debug(`Google Books: ${fallback ? 'encontrado' : 'no encontrado'}`);
  if (fallback) return fallback;
  if (primaryError) throw primaryError;
  return null;
}
