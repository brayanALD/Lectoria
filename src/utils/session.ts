import type {
  NewSessionFields,
  SessionBookContext,
  SessionFormErrors,
  SessionFormResult,
  SessionFormValues,
} from '../types/session';
import { planStatusChange, type BookProgressState, type StatusChange } from './book';

// Límites alineados con firestore.rules (validSession).
export const MAX_SESSION_MINUTES = 1440;
export const MAX_SESSION_PAGE = 100000;
export const MAX_SESSION_NOTES = 5000;

/**
 * Un día cuenta como «día de lectura» si tiene al menos una sesión con MÁS de este número de minutos
 * o con MÁS de este número de páginas (basta una de las dos condiciones). Decisión del 2026-10-13.
 */
export const READING_DAY_MIN_MINUTES = 1;
export const READING_DAY_MIN_PAGES = 1;

/** Margen para relojes ligeramente adelantados al validar que la sesión no es futura. */
const FUTURE_TOLERANCE_MS = 60_000;

const INTEGER = /^\d+$/;

/** ¿Esta sesión basta para que su día cuente como día de lectura? */
export function isReadingSession(session: { durationMinutes: number; pagesRead: number }): boolean {
  return session.durationMinutes > READING_DAY_MIN_MINUTES || session.pagesRead > READING_DAY_MIN_PAGES;
}

/**
 * «YYYY-MM-DD» de un instante en una zona horaria (por defecto, la del dispositivo).
 * Es la clave con la que se agrupan las sesiones por día: guardarla evita errores de zona horaria al calcular
 * rachas y calendario. Una zona inválida cae a la del dispositivo en lugar de fallar.
 */
export function toDateKey(date: Date, timeZone?: string): string {
  const format = (zone?: string) =>
    new Intl.DateTimeFormat('en-US', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);

  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = format(timeZone);
  } catch {
    parts = format(undefined);
  }
  const part = (type: 'year' | 'month' | 'day') => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/**
 * Valida el formulario «Registrar lectura» y lo convierte en los campos que se guardan.
 * - Minutos: opcionales, enteros de 0 a 1440.
 * - Página final: opcional; las páginas leídas son final − inicial, y la inicial por defecto es la página actual.
 * - Hay que indicar al menos minutos o página final (las reglas de Firestore exigen páginas o minutos > 0).
 */
export function parseSessionForm(
  values: SessionFormValues,
  bookId: string,
  book: SessionBookContext,
  now: Date = new Date(),
  timeZone?: string,
): SessionFormResult {
  const errors: SessionFormErrors = {};

  if (Number.isNaN(values.date.getTime()) || values.date.getTime() > now.getTime() + FUTURE_TOLERANCE_MS) {
    errors.date = 'La fecha no puede ser futura.';
  }

  let durationMinutes = 0;
  const minutesText = values.minutes.trim();
  if (minutesText) {
    if (!INTEGER.test(minutesText) || Number(minutesText) > MAX_SESSION_MINUTES) {
      errors.minutes = `Introduce un número entero de minutos (máximo ${MAX_SESSION_MINUTES}).`;
    } else {
      durationMinutes = Number(minutesText);
    }
  }

  const maxPage = book.pageCount ?? MAX_SESSION_PAGE;
  const parsePage = (text: string, field: 'startPage' | 'endPage'): number | undefined => {
    const trimmed = text.trim();
    if (!trimmed) return undefined;
    if (!INTEGER.test(trimmed) || Number(trimmed) > maxPage) {
      errors[field] = book.pageCount
        ? `Introduce una página entre 0 y ${book.pageCount}.`
        : `Introduce un número de página válido.`;
      return undefined;
    }
    return Number(trimmed);
  };

  const endPage = parsePage(values.endPage, 'endPage');
  const explicitStart = parsePage(values.startPage, 'startPage');
  let startPage: number | undefined;
  let pagesRead = 0;

  if (explicitStart !== undefined && endPage === undefined && !errors.endPage) {
    errors.endPage = 'Indica también la página final.';
  }
  if (endPage !== undefined) {
    startPage = explicitStart ?? book.currentPage;
    if (startPage > endPage) {
      errors.endPage =
        explicitStart !== undefined
          ? 'La página final no puede ser anterior a la inicial.'
          : `Ibas por la página ${book.currentPage}. Indica una página posterior.`;
    } else {
      pagesRead = endPage - startPage;
    }
  }

  // Sin minutos ni páginas nuevas no hay nada que registrar (las reglas de Firestore también lo exigen).
  const hasFieldError = Boolean(errors.minutes || errors.startPage || errors.endPage);
  if (!hasFieldError && durationMinutes === 0) {
    if (endPage === undefined) errors.general = 'Indica los minutos leídos o la página en la que vas.';
    else if (pagesRead === 0) errors.general = 'Esa es la misma página en la que ibas. Indica minutos o una página posterior.';
  }

  const notes = values.notes.trim();
  if (notes.length > MAX_SESSION_NOTES) errors.notes = `Las notas no pueden superar ${MAX_SESSION_NOTES} caracteres.`;

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const data: NewSessionFields = {
    bookId,
    date: values.date,
    dateKey: toDateKey(values.date, timeZone),
    pagesRead,
    durationMinutes,
  };
  if (endPage !== undefined && startPage !== undefined) {
    data.startPage = startPage;
    data.endPage = endPage;
  }
  if (notes) data.notes = notes;
  return { ok: true, data };
}

export interface SessionBookUpdate extends StatusChange {
  /** false si la sesión no cambia nada del libro (no hace falta escribirlo). */
  changed: boolean;
}

/**
 * Qué cambia en el libro al registrar una sesión:
 * - La página actual avanza a la página final, pero nunca retrocede (una sesión con fecha pasada no debe
 *   deshacer un avance posterior).
 * - Un libro pendiente, en pausa o abandonado pasa a «Leyendo» al leer.
 * - Al llegar a la última página (si se conoce el total) pasa a «Terminado».
 * - Un libro ya terminado conserva su estado.
 */
export function planSessionBookUpdate(book: BookProgressState, endPage: number | undefined): SessionBookUpdate {
  const nextPage = endPage === undefined ? book.currentPage : Math.max(book.currentPage, endPage);

  let nextStatus = book.status;
  if (book.status !== 'finished') {
    if (book.pageCount && nextPage >= book.pageCount) nextStatus = 'finished';
    else if (book.status !== 'reading') nextStatus = 'reading';
  }

  const change = planStatusChange(book, nextStatus);
  // `planStatusChange` ya fija la última página al terminar; en el resto de casos se aplica el avance.
  const currentPage = change.currentPage ?? (nextPage !== book.currentPage ? nextPage : undefined);
  const result: SessionBookUpdate = { ...change, changed: false };
  if (currentPage !== undefined) result.currentPage = currentPage;
  result.changed =
    result.currentPage !== undefined ||
    nextStatus !== book.status ||
    result.setStartedAt ||
    result.setFinishedAt ||
    result.clearFinishedAt;
  return result;
}
