import { isReadingSession } from './session';

/** Lo que se necesita de una sesión para agrupar por día (sin depender de Firebase). */
interface DaySession {
  dateKey: string;
  durationMinutes: number;
  pagesRead: number;
}

export interface DaySummary {
  dateKey: string;
  minutes: number;
  pages: number;
  sessions: number;
  /** El día cuenta para la racha: tiene al menos una sesión que supera el mínimo (ver `isReadingSession`). */
  isReadingDay: boolean;
}

const DAY_MS = 86_400_000;

/** Número de día desde 1970 de una clave «YYYY-MM-DD». Se calcula en UTC para que el horario de verano no influya. */
export function dayNumber(dateKey: string): number {
  const [year, month, day] = dateKey.split('-').map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
}

/** La clave de `dateKey` desplazada `days` días (negativo = hacia atrás). */
export function addDays(dateKey: string, days: number): string {
  return new Date((dayNumber(dateKey) + days) * DAY_MS).toISOString().slice(0, 10);
}

/** Totales por día. Los días sin sesiones no aparecen. */
export function summarizeByDay(sessions: readonly DaySession[]): Map<string, DaySummary> {
  const days = new Map<string, DaySummary>();
  for (const session of sessions) {
    const day = days.get(session.dateKey) ?? {
      dateKey: session.dateKey,
      minutes: 0,
      pages: 0,
      sessions: 0,
      isReadingDay: false,
    };
    day.minutes += session.durationMinutes;
    day.pages += session.pagesRead;
    day.sessions += 1;
    day.isReadingDay = day.isReadingDay || isReadingSession(session);
    days.set(session.dateKey, day);
  }
  return days;
}

/** Claves de los días que cuentan como día de lectura. */
export function getReadingDays(sessions: readonly DaySession[]): Set<string> {
  const readingDays = new Set<string>();
  for (const day of summarizeByDay(sessions).values()) if (day.isReadingDay) readingDays.add(day.dateKey);
  return readingDays;
}

export interface Streaks {
  /** Días consecutivos de lectura hasta hoy (o hasta ayer, si hoy aún no se ha leído). */
  current: number;
  /** Récord histórico. */
  longest: number;
}

/**
 * Rachas a partir de los días de lectura:
 * - Racha actual: días consecutivos que terminan hoy. Si hoy todavía no se ha leído, se mantiene la que terminaba
 *   ayer hasta que acabe el día (no se pierde la racha por mirar la app por la mañana).
 * - Racha máxima: la mejor de todo el historial.
 * Los días posteriores a `today` (p. ej. por un cambio de zona horaria) no cuentan para la racha actual.
 */
export function computeStreaks(readingDays: Iterable<string>, today: string): Streaks {
  const days = new Set([...readingDays].map(dayNumber));
  if (days.size === 0) return { current: 0, longest: 0 };

  let longest = 0;
  for (const day of days) {
    if (days.has(day - 1)) continue; // solo se cuenta desde el primer día de cada racha
    let length = 1;
    while (days.has(day + length)) length += 1;
    longest = Math.max(longest, length);
  }

  const todayNumber = dayNumber(today);
  let cursor = days.has(todayNumber) ? todayNumber : todayNumber - 1;
  let current = 0;
  while (days.has(cursor)) {
    current += 1;
    cursor -= 1;
  }
  return { current, longest };
}
