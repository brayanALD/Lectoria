import type { DaySummary } from './readingDays';

export interface PeriodTotals {
  /** Días que cuentan como día de lectura (ver `isReadingSession`). */
  readingDays: number;
  minutes: number;
  pages: number;
  sessions: number;
}

export interface MonthTotals extends PeriodTotals {
  /** 1 a 12. */
  month: number;
  daysInMonth: number;
}

const EMPTY_TOTALS: PeriodTotals = { readingDays: 0, minutes: 0, pages: 0, sessions: 0 };

function add(totals: PeriodTotals, day: DaySummary): PeriodTotals {
  return {
    readingDays: totals.readingDays + (day.isReadingDay ? 1 : 0),
    minutes: totals.minutes + day.minutes,
    pages: totals.pages + day.pages,
    sessions: totals.sessions + day.sessions,
  };
}

/** Totales de un conjunto de días (p. ej. los siete de una semana). Los días sin sesiones no suman. */
export function totalsForDays(days: ReadonlyMap<string, DaySummary>, keys: readonly string[]): PeriodTotals {
  return keys.reduce((totals, key) => {
    const day = days.get(key);
    return day ? add(totals, day) : totals;
  }, EMPTY_TOTALS);
}

/** Minutos, páginas y número de sesiones de una lista de sesiones (p. ej. las de un libro). */
export function totalsForSessions(
  sessions: readonly { durationMinutes: number; pagesRead: number }[],
): Pick<PeriodTotals, 'minutes' | 'pages' | 'sessions'> {
  return sessions.reduce(
    (totals, session) => ({
      minutes: totals.minutes + session.durationMinutes,
      pages: totals.pages + session.pagesRead,
      sessions: totals.sessions + 1,
    }),
    { minutes: 0, pages: 0, sessions: 0 },
  );
}

/** Totales de un año completo, mes a mes (siempre devuelve los doce meses, aunque estén vacíos). */
export function summarizeYear(
  days: ReadonlyMap<string, DaySummary>,
  year: number,
): { months: MonthTotals[]; total: PeriodTotals } {
  const months: MonthTotals[] = Array.from({ length: 12 }, (_, index) => ({
    ...EMPTY_TOTALS,
    month: index + 1,
    daysInMonth: new Date(Date.UTC(year, index + 1, 0)).getUTCDate(),
  }));

  let total = EMPTY_TOTALS;
  for (const day of days.values()) {
    if (!day.dateKey.startsWith(`${year}-`)) continue;
    const month = months[Number(day.dateKey.slice(5, 7)) - 1];
    Object.assign(month, add(month, day));
    total = add(total, day);
  }
  return { months, total };
}

/** «45 min», «2 h», «2 h 05 min». */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, '0')} min`;
}

/** «1 pág», «40 págs». */
export function formatPages(pages: number): string {
  return `${pages} ${pages === 1 ? 'pág' : 'págs'}`;
}

/** «2 h 05 min · 40 págs», omitiendo la parte que sea cero; «Sin lectura» si no hay nada. */
export function formatTotals(totals: Pick<PeriodTotals, 'minutes' | 'pages'>): string {
  const parts = [
    totals.minutes > 0 ? formatDuration(totals.minutes) : null,
    totals.pages > 0 ? formatPages(totals.pages) : null,
  ].filter((part): part is string => part !== null);
  return parts.length > 0 ? parts.join(' · ') : 'Sin lectura';
}
