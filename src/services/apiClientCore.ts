// Cliente HTTP único de la API de Lectoria (sin dependencias de Firebase ni de React Native, para poder probarlo).
// Convierte las respuestas de error al mismo vocabulario de códigos que ya entienden las pantallas
// (`getFirestoreErrorMessage`), así que ninguna pantalla distingue entre «error de Firestore» y «error de la API»:
//
//   sin red                          -> unavailable
//   tiempo agotado                   -> lectoria/timeout          (la operación pudo aplicarse: ver `requestId`)
//   400                              -> invalid-argument (+ `fields`)
//   401                              -> unauthenticated
//   404                              -> not-found
//   409 BOOK_NOT_OWNED               -> lectoria/book-not-owned
//   429                              -> resource-exhausted (o lectoria/catalog-rate-limited)
//   502 CATALOG_UNAVAILABLE          -> lectoria/catalog-unavailable
//   502/503/504 (servidor dormido)   -> lectoria/server-unavailable
//   el resto                         -> internal

export interface ApiError extends Error {
  code: string;
  /** Estado HTTP, si la API llegó a responder. */
  status?: number;
  /** Código propio de la API (`VALIDATION`, `BOOK_NOT_OWNED`…). */
  apiCode?: string;
  /** Errores por campo de un 400. */
  fields?: Record<string, string>;
}

function createError(code: string, message: string, extra: Partial<ApiError> = {}): ApiError {
  return Object.assign(new Error(message), { code }, extra);
}

/** Traduce una respuesta de error de la API al código que usa la app. */
export function toErrorCode(status: number, apiCode?: string): string {
  if (status === 400) return 'invalid-argument';
  if (status === 401) return 'unauthenticated';
  if (status === 404) return 'not-found';
  if (status === 409) return apiCode === 'BOOK_NOT_OWNED' ? 'lectoria/book-not-owned' : 'failed-precondition';
  if (status === 429) return apiCode === 'CATALOG_RATE_LIMITED' ? 'lectoria/catalog-rate-limited' : 'resource-exhausted';
  if (status === 502 && apiCode === 'CATALOG_UNAVAILABLE') return 'lectoria/catalog-unavailable';
  if ([502, 503, 504].includes(status)) return 'lectoria/server-unavailable';
  return 'internal';
}

export interface RequestOptions {
  body?: unknown;
  /** Tiempo máximo de esta solicitud; por defecto el del cliente. */
  timeoutMs?: number;
}

export interface ApiClientConfig {
  /** Dirección base de la API («https://…»), con o sin barra final. Vacía = la API no está configurada. */
  baseUrl: string;
  /** El ID token de Firebase Auth de la sesión actual. */
  getToken: () => Promise<string>;
  fetchFn?: typeof fetch;
  /** Debe cubrir un arranque en frío del servicio (el hosting gratuito lo duerme tras un rato sin uso). */
  timeoutMs?: number;
}

export const DEFAULT_TIMEOUT_MS = 30_000;
/** El aviso de «despierta» puede tardar lo que tarda el arranque en frío del servicio. */
const PING_TIMEOUT_MS = 60_000;

export function createApiClient({ baseUrl, getToken, fetchFn = (...args) => fetch(...args), timeoutMs = DEFAULT_TIMEOUT_MS }: ApiClientConfig) {
  const base = baseUrl.trim().replace(/\/+$/, '');

  async function request<T = undefined>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
    if (!base) throw createError('lectoria/api-not-configured', 'La API no está configurada (EXPO_PUBLIC_API_URL).');

    let token: string;
    try {
      token = await getToken();
    } catch (error) {
      const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code: unknown }).code) : '';
      // Sin red para renovar el token es un fallo de conexión; sin sesión, un fallo de permisos.
      if (code.includes('network')) throw createError('unavailable', 'Sin conexión.');
      throw createError('unauthenticated', 'Sin sesión.');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? timeoutMs);
    let response: Response;
    try {
      response = await fetchFn(base + path, {
        method,
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      });
    } catch (error) {
      if (controller.signal.aborted || (error as { name?: string } | null)?.name === 'AbortError') {
        throw createError('lectoria/timeout', 'timeout');
      }
      // En React Native un fallo de red es un TypeError («Network request failed»).
      throw createError('unavailable', 'Sin conexión.');
    } finally {
      clearTimeout(timer);
    }

    const text = await response.text().catch(() => '');
    let json: unknown;
    try {
      json = text ? JSON.parse(text) : undefined;
    } catch {
      // Una respuesta que no es JSON (p. ej. la página de error del hosting mientras el servicio despierta).
      json = undefined;
    }

    if (!response.ok) {
      const detail = (json as { error?: { code?: unknown; message?: unknown; fields?: unknown } } | undefined)?.error;
      const apiCode = typeof detail?.code === 'string' ? detail.code : undefined;
      throw createError(
        toErrorCode(response.status, apiCode),
        typeof detail?.message === 'string' ? detail.message : `HTTP ${response.status}`,
        {
          status: response.status,
          apiCode,
          ...(detail?.fields && typeof detail.fields === 'object' ? { fields: detail.fields as Record<string, string> } : {}),
        },
      );
    }
    if (text && json === undefined) {
      throw createError('internal', 'Respuesta inesperada del servidor.', { status: response.status });
    }
    return json as T;
  }

  return {
    get: <T>(path: string, options?: RequestOptions) => request<T>('GET', path, options),
    post: <T = undefined>(path: string, body?: unknown, options?: RequestOptions) => request<T>('POST', path, { ...options, body }),
    put: <T = undefined>(path: string, body?: unknown, options?: RequestOptions) => request<T>('PUT', path, { ...options, body }),
    patch: <T = undefined>(path: string, body?: unknown, options?: RequestOptions) => request<T>('PATCH', path, { ...options, body }),
    delete: <T = undefined>(path: string, options?: RequestOptions) => request<T>('DELETE', path, options),
    /** `GET /v1/salud`: no pide sesión; despierta el servicio si estaba dormido. Nunca lanza. */
    async ping(): Promise<boolean> {
      if (!base) return false;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
      try {
        return (await fetchFn(`${base}/v1/salud`, { signal: controller.signal })).ok;
      } catch {
        return false;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}


export type ApiClient = ReturnType<typeof createApiClient>;
