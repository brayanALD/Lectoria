import type { ReadingStatus } from '../types/book';
import type { DailyGoal, GoalType } from '../types/goal';
import { compareMonths, getMonthDayKeys, monthOf, type YearMonth } from './calendar';
import { formatGoalValue, getGoalProgress, type GoalProgressInfo } from './dailyGoal';
import type { DateLike } from './dateUtils';
import type { DaySummary } from './readingDays';
import { totalsForDays, type PeriodTotals } from './readingStats';
import { toDateKey } from './session';

// Todo lo de este archivo se deriva de los resúmenes por día (`summarizeByDay`, que salen de las sesiones) y de los
// libros: no hay contadores guardados. Así las estadísticas siempre coinciden con Inicio, el Calendario y el detalle
// del libro, y se recalculan solas al crear, editar o eliminar una sesión.

/** Lo que mide el gráfico diario: la unidad de la meta o, sin meta, los minutos. */
export function chartMetric(goal: DailyGoal | undefined): GoalType {
  return goal?.type ?? 'minutes';
}

export interface DayStats {
  dateKey: string;
  minutes: number;
  pages: number;
  sessions: number;
  /** El día cuenta como día de lectura (ver `isReadingSession`). */
  isReadingDay: boolean;
  /** Cuánto de la meta se cumplió ese día; `undefined` si no hay meta. */
  progress?: GoalProgressInfo;
}

/** Resumen de un día: lo leído, cuántas sesiones fueron y, si hay meta, su cumplimiento. */
export function summarizeDay(days: ReadonlyMap<string, DaySummary>, dateKey: string, goal?: DailyGoal): DayStats {
  const day = days.get(dateKey);
  const minutes = day?.minutes ?? 0;
  const pages = day?.pages ?? 0;
  return {
    dateKey,
    minutes,
    pages,
    sessions: day?.sessions ?? 0,
    isReadingDay: day?.isReadingDay ?? false,
    ...(goal ? { progress: getGoalProgress({ minutes, pages }, goal) } : {}),
  };
}

export interface DayPoint {
  dateKey: string;
  minutes: number;
  pages: number;
  /** Lo que dibuja el gráfico ese día: minutos o páginas, según `chartMetric`. */
  value: number;
  /** El día todavía no ha llegado (posterior a hoy). */
  future: boolean;
  /** Meta cumplida ese día. Ausente si no hay meta o si el día es futuro (aún no se puede cumplir ni incumplir). */
  goalMet?: boolean;
}

export interface MonthStats {
  month: YearMonth;
  daysInMonth: number;
  /** Días del mes que ya han llegado, hoy incluido: todos en un mes pasado, los transcurridos en el actual, 0 en uno futuro. */
  elapsedDays: number;
  totals: PeriodTotals;
  /** Un punto por día del mes, en orden. */
  points: DayPoint[];
  /** El valor diario más alto del mes (0 si no hubo lectura): escala del gráfico. */
  maxValue: number;
  /** Cumplimiento de la meta en el mes; ausente si no hay meta. */
  goal?: {
    /** Días transcurridos en que se cumplió la meta. */
    daysMet: number;
    /** 0–100, entero, sobre los días transcurridos. Solo llega a 100 si se cumplió todos los días. */
    percent: number;
  };
}

/**
 * Resumen de un mes: totales (tiempo, páginas, días de lectura, sesiones), un punto por día para el gráfico y, si
 * hay meta, cuántos días se cumplió. Los días futuros no cuentan como incumplidos: la meta solo se evalúa hasta hoy.
 */
export function summarizeMonth(
  days: ReadonlyMap<string, DaySummary>,
  month: YearMonth,
  todayKey: string,
  goal?: DailyGoal,
): MonthStats {
  const keys = getMonthDayKeys(month);
  const metric = chartMetric(goal);

  const points: DayPoint[] = keys.map((dateKey) => {
    const day = days.get(dateKey);
    const minutes = day?.minutes ?? 0;
    const pages = day?.pages ?? 0;
    const future = dateKey > todayKey;
    return {
      dateKey,
      minutes,
      pages,
      value: metric === 'minutes' ? minutes : pages,
      future,
      ...(goal && !future ? { goalMet: getGoalProgress({ minutes, pages }, goal).met } : {}),
    };
  });

  const elapsedDays = points.filter((point) => !point.future).length;
  const daysMet = points.filter((point) => point.goalMet).length;

  return {
    month,
    daysInMonth: keys.length,
    elapsedDays,
    totals: totalsForDays(days, keys),
    points,
    maxValue: Math.max(0, ...points.map((point) => point.value)),
    ...(goal
      ? { goal: { daysMet, percent: elapsedDays > 0 ? Math.floor((daysMet / elapsedDays) * 100) : 0 } }
      : {}),
  };
}

/** Lo que se necesita de un libro para contarlo como terminado en un mes (sin depender de Firebase). */
interface FinishableBook {
  status: ReadingStatus;
  finishedAt?: DateLike;
}

/**
 * Cuántos libros se terminaron en un mes: los que están en «Terminado» y cuya fecha de fin cae en ese mes. El día de
 * la fecha de fin se calcula en la misma zona horaria que el de las sesiones (por defecto, la del dispositivo).
 */
export function countFinishedBooks(books: readonly FinishableBook[], month: YearMonth, timeZone?: string): number {
  return books.filter((book) => {
    if (book.status !== 'finished' || !book.finishedAt) return false;
    return compareMonths(monthOf(toDateKey(book.finishedAt.toDate(), timeZone)), month) === 0;
  }).length;
}

/** El día del mes con más lectura (el primero si hay empate); `undefined` si no hubo lectura. */
export function busiestDay(points: readonly DayPoint[]): DayPoint | undefined {
  let best: DayPoint | undefined;
  for (const point of points) if (point.value > 0 && (!best || point.value > best.value)) best = point;
  return best;
}

/** Descripción del gráfico diario para el lector de pantalla: lo que se ve en las barras, dicho en una frase. */
export function describeMonthChart(stats: MonthStats, metric: GoalType): string {
  const unit = metric === 'minutes' ? 'Minutos' : 'Páginas';
  const best = busiestDay(stats.points);
  const days = `${stats.totals.readingDays} ${stats.totals.readingDays === 1 ? 'día de lectura' : 'días de lectura'}`;
  if (!best) return `${unit} por día. ${days}.`;
  return `${unit} por día. ${days}. Más lectura: día ${Number(best.dateKey.slice(8))}, ${formatGoalValue(metric, best.value)}.`;
}
