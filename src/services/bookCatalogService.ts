import type { CatalogBook } from '../types/book';
import { api } from './apiClient';

// La búsqueda por ISBN la hace la API (`api/src/services/catalog.ts`): consulta Open Library y, si hay clave en el
// servidor, Google Books como respaldo, y recuerda los resultados. La app ya no conoce a los proveedores ni lleva ninguna
// clave de catálogo. Los errores llegan con los códigos que entiende `getCatalogErrorMessage`.
export const CATALOG_UNAVAILABLE = 'lectoria/catalog-unavailable';
export const CATALOG_RATE_LIMITED = 'lectoria/catalog-rate-limited';

/**
 * Busca un libro por su ISBN-13 (ya validado). Devuelve null si ningún catálogo lo conoce. Lanza
 * `lectoria/catalog-unavailable` (sin red, tiempo agotado o error del servidor) o `lectoria/catalog-rate-limited`
 * (demasiadas consultas seguidas).
 */
export async function findBookByIsbn(isbn13: string): Promise<CatalogBook | null> {
  try {
    const { book } = await api.get<{ book: CatalogBook | null }>(`/v1/catalog/isbn/${encodeURIComponent(isbn13)}`, {
      timeoutMs: 20_000,
    });
    return book;
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code: unknown }).code) : '';
    if (code === CATALOG_RATE_LIMITED || code === CATALOG_UNAVAILABLE) throw error;
    // Sin red, servidor dormido, tiempo agotado… para quien busca todo es «no se pudo consultar el catálogo».
    throw Object.assign(new Error(CATALOG_UNAVAILABLE), { code: CATALOG_UNAVAILABLE });
  }
}
