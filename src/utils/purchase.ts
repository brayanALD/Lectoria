import type { PurchaseFields } from '../types/book';
import { dateForDay, formatDateKeyLong } from './calendar';
import type { DateLike } from './dateUtils';
import { toDateKey } from './session';

/** Precio máximo; alineado con firestore.rules (validBook → price). */
export const MAX_PRICE = 999_999_999;

export type PriceResult = { ok: true; price?: number } | { ok: false; error: string };

const PRICE_ERROR = 'Introduce un precio válido (por ejemplo 45000 o 45,50).';

/**
 * Convierte lo escrito en el precio. El precio es opcional (vacío = sin precio) y se guarda sin moneda.
 * Entiende los dos separadores a la manera del español:
 * - Un solo separador seguido de 1 o 2 cifras es decimal («45,5», «45.50»); seguido de 3 cifras separa miles («45.000»).
 * - Con los dos, el último es el decimal y el otro separa miles («1.234,50», «1,234.50»).
 * Cualquier otra combinación («1.2.3», «12.3456») se rechaza en lugar de adivinar.
 */
export function parsePriceInput(text: string): PriceResult {
  const trimmed = text.trim();
  if (!trimmed) return { ok: true };
  if (!/^\d[\d.,]*$/.test(trimmed)) return { ok: false, error: PRICE_ERROR };

  const lastSeparator = Math.max(trimmed.lastIndexOf('.'), trimmed.lastIndexOf(','));
  let value: number;

  if (lastSeparator === -1) {
    value = Number(trimmed);
  } else {
    const before = trimmed.slice(0, lastSeparator);
    const after = trimmed.slice(lastSeparator + 1);
    const separator = trimmed[lastSeparator];
    const thousands = /^\d{1,3}([.,]\d{3})*$/;

    if (after.length >= 1 && after.length <= 2) {
      // Decimal: lo anterior es un entero, o miles agrupados con el OTRO separador.
      const groupsOk =
        /^\d+$/.test(before) || (thousands.test(before) && !before.includes(separator));
      if (!groupsOk) return { ok: false, error: PRICE_ERROR };
      value = Number(`${before.replace(/[.,]/g, '')}.${after}`);
    } else if (after.length === 3) {
      // Miles: todos los separadores son el mismo y las agrupaciones son de 3 cifras.
      const sameSeparator = [...trimmed].filter((c) => c === '.' || c === ',').every((c) => c === separator);
      if (!sameSeparator || !thousands.test(trimmed)) return { ok: false, error: PRICE_ERROR };
      value = Number(trimmed.replace(/[.,]/g, ''));
    } else {
      return { ok: false, error: PRICE_ERROR };
    }
  }

  if (!Number.isFinite(value)) return { ok: false, error: PRICE_ERROR };
  const price = Math.round(value * 100) / 100;
  if (price > MAX_PRICE) return { ok: false, error: `El precio no puede superar ${formatPrice(MAX_PRICE)}.` };
  return { ok: true, price };
}

/** «45.000» o «45,5»: el precio con el formato del español, sin moneda (no se guarda). */
export function formatPrice(price: number): string {
  return new Intl.NumberFormat('es', { maximumFractionDigits: 2 }).format(price);
}

export interface PurchaseFormValues {
  /** Día de la compra («YYYY-MM-DD»). */
  dateKey: string;
  /** Precio tal como se escribe (opcional). */
  price: string;
}

export type PurchaseFormResult =
  | { ok: true; data: PurchaseFields }
  | { ok: false; errors: { date?: string; price?: string } };

/**
 * Valida los datos de la compra y los convierte en lo que se guarda: la fecha es obligatoria y no puede ser futura
 * (un día pasado se guarda al mediodía, como las lecturas, para que ninguna zona horaria lo cambie de día) y el
 * precio es opcional.
 */
export function parsePurchaseForm(
  values: PurchaseFormValues,
  now: Date,
  todayKey: string,
): PurchaseFormResult {
  const errors: { date?: string; price?: string } = {};

  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.dateKey) || Number.isNaN(dateForDay(values.dateKey, now, todayKey).getTime())) {
    errors.date = 'Elige la fecha de la compra.';
  } else if (values.dateKey > todayKey) {
    errors.date = 'La fecha de compra no puede ser futura.';
  }

  const price = parsePriceInput(values.price);
  if (!price.ok) errors.price = price.error;

  if (errors.date || errors.price || !price.ok) return { ok: false, errors };

  const data: PurchaseFields = { purchasedAt: dateForDay(values.dateKey, now, todayKey) };
  if (price.price !== undefined) data.price = price.price;
  return { ok: true, data };
}

/** «13 de octubre de 2026 · 45.000», con solo lo que haya; `undefined` si el libro no tiene datos de compra. */
export function describePurchase(book: { price?: number; purchasedAt?: DateLike }, timeZone?: string): string | undefined {
  const parts: string[] = [];
  if (book.purchasedAt) parts.push(formatDateKeyLong(toDateKey(book.purchasedAt.toDate(), timeZone)));
  if (book.price !== undefined) parts.push(formatPrice(book.price));
  return parts.length > 0 ? parts.join(' · ') : undefined;
}
