import dayjs from 'dayjs';
import 'dayjs/locale/es';

import { addDays } from './readingDays';
import { formatLongDate } from './dateUtils';

/** Iniciales de los días, de lunes a domingo (la «X» distingue miércoles de martes, como es habitual en español). */
export const WEEKDAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const;

export interface YearMonth {
  year: number;
  /** 1 a 12. */
  month: number;
}

const pad = (value: number) => String(value).padStart(2, '0');

/** «YYYY-MM-DD» de un día concreto (mes de 1 a 12). */
export function toDayKey(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Año y mes de una clave «YYYY-MM-DD». */
export function monthOf(dateKey: string): YearMonth {
  const [year, month] = dateKey.split('-').map(Number);
  return { year, month };
}

/** Compara meses: negativo si `a` es anterior a `b`, 0 si son el mismo, positivo si es posterior. */
export function compareMonths(a: YearMonth, b: YearMonth): number {
  return a.year * 12 + a.month - (b.year * 12 + b.month);
}

/** El mes `delta` meses después (o antes, si es negativo), cruzando años. */
export function addMonths({ year, month }: YearMonth, delta: number): YearMonth {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12 + 12) % 12 + 1 };
}

/** «octubre de 2026». */
export function formatMonthLabel({ year, month }: YearMonth): string {
  return dayjs(new Date(year, month - 1, 1)).locale('es').format('MMMM [de] YYYY');
}

/**
 * Cuadrícula de un mes por semanas (lunes a domingo). Cada celda es la clave del día o `null` para los huecos
 * antes del día 1 y después del último día. Todas las filas tienen 7 celdas.
 */
export function getMonthGrid({ year, month }: YearMonth): (string | null)[][] {
  // UTC para que el horario de verano del dispositivo no desplace el día.
  const mondayFirstOffset = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const cells: (string | null)[] = [
    ...Array<null>(mondayFirstOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, index) => toDayKey(year, month, index + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return Array.from({ length: cells.length / 7 }, (_, row) => cells.slice(row * 7, row * 7 + 7));
}

/**
 * Instante con el que se guarda una sesión de ese día. Hoy conserva la hora actual; un día pasado se fija al
 * mediodía, lejos de la medianoche, para que ninguna zona horaria lo cambie de día al calcular su `dateKey`.
 */
export function dateForDay(dateKey: string, now: Date, todayKey: string): Date {
  if (dateKey === todayKey) return now;
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
}

/** La fecha completa de una clave («13 de octubre de 2026»). */
export function formatDateKeyLong(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  return formatLongDate(new Date(year, month - 1, day));
}

/** «Hoy», «Ayer» o la fecha completa («13 de octubre de 2026»). */
export function formatDayLabel(dateKey: string, todayKey: string): string {
  if (dateKey === todayKey) return 'Hoy';
  if (dateKey === addDays(todayKey, -1)) return 'Ayer';
  return formatDateKeyLong(dateKey);
}
