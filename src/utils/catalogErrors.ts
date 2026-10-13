const MESSAGES: Record<string, string> = {
  'lectoria/catalog-unavailable': 'No se pudo consultar el catálogo. Revisa tu conexión o rellena los datos a mano.',
  'lectoria/catalog-rate-limited': 'Demasiadas consultas seguidas. Espera un momento e inténtalo de nuevo.',
};

const FALLBACK = 'No se pudo consultar el catálogo. Rellena los datos a mano.';

export const ISBN_NOT_FOUND_MESSAGE = 'No encontramos ese ISBN. Rellena los datos a mano.';

export function getCatalogErrorMessage(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error ? String((error as { code: unknown }).code) : '';
  return MESSAGES[code] ?? FALLBACK;
}
