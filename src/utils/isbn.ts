export type IsbnResult =
  | { ok: true; isbn13: string }
  | { ok: false; reason: 'empty' | 'format' | 'checksum' };

/** Quita espacios y guiones y pasa a mayúsculas (la «X» final de un ISBN-10 puede venir en minúscula). */
export function normalizeIsbn(input: string): string {
  return input.replace(/[\s-]/g, '').toUpperCase();
}

export function isValidIsbn10(isbn: string): boolean {
  if (!/^\d{9}[\dX]$/.test(isbn)) return false;
  const sum = [...isbn].reduce((total, char, index) => total + (10 - index) * (char === 'X' ? 10 : Number(char)), 0);
  return sum % 11 === 0;
}

export function isValidIsbn13(isbn: string): boolean {
  if (!/^97[89]\d{10}$/.test(isbn)) return false;
  const sum = [...isbn].reduce((total, char, index) => total + Number(char) * (index % 2 === 0 ? 1 : 3), 0);
  return sum % 10 === 0;
}

/** Convierte un ISBN-10 válido en su ISBN-13 (prefijo 978 y nuevo dígito de control). */
export function toIsbn13(isbn10: string): string {
  const body = `978${isbn10.slice(0, 9)}`;
  const sum = [...body].reduce((total, char, index) => total + Number(char) * (index % 2 === 0 ? 1 : 3), 0);
  return body + String((10 - (sum % 10)) % 10);
}

/**
 * Valida el texto de un ISBN (con o sin guiones, ISBN-10 o ISBN-13) y lo devuelve normalizado a ISBN-13.
 * Los códigos de barras de los libros son EAN-13 que empiezan por 978 o 979, es decir, su ISBN-13.
 */
export function parseIsbn(input: string): IsbnResult {
  const isbn = normalizeIsbn(input);
  if (!isbn) return { ok: false, reason: 'empty' };

  if (isbn.length === 10) {
    if (!/^\d{9}[\dX]$/.test(isbn)) return { ok: false, reason: 'format' };
    return isValidIsbn10(isbn) ? { ok: true, isbn13: toIsbn13(isbn) } : { ok: false, reason: 'checksum' };
  }
  if (isbn.length === 13) {
    if (!/^97[89]\d{10}$/.test(isbn)) return { ok: false, reason: 'format' };
    return isValidIsbn13(isbn) ? { ok: true, isbn13: isbn } : { ok: false, reason: 'checksum' };
  }
  return { ok: false, reason: 'format' };
}

const MESSAGES: Record<'empty' | 'format' | 'checksum', string> = {
  empty: 'Introduce un ISBN.',
  format: 'El ISBN debe tener 10 o 13 dígitos.',
  checksum: 'Ese ISBN no es válido. Revisa los dígitos.',
};

export function getIsbnErrorMessage(reason: 'empty' | 'format' | 'checksum'): string {
  return MESSAGES[reason];
}

/**
 * Qué decir cuando el escáner lee un código que no es un ISBN utilizable.
 * `format`: no es de un libro (p. ej. un producto); `checksum`: lectura defectuosa, conviene reintentar.
 */
export function getScanFeedback(reason: 'empty' | 'format' | 'checksum'): string | null {
  if (reason === 'format') return 'Ese código no es de un libro.';
  if (reason === 'checksum') return 'No se leyó bien. Prueba de nuevo.';
  return null;
}
