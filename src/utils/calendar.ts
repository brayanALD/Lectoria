import dayjs from 'dayjs';
import 'dayjs/locale/es';

import { addDays, dayNumber } from './readingDays';
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

/**
 * Día que se preselecciona al registrar una lectura desde un día elegido: ese día si es una fecha real y no es
 * futura; si no (falta, mal formada, inexistente o futura), hoy. Una lectura nunca se registra en el futuro.
 */
export function resolveDayKey(day: string | undefined, todayKey: string): string {
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day) || addDays(day, 0) !== day || day > todayKey) return todayKey;
  return day;
}

/** Milisegundos que faltan para el próximo cambio de día (medianoche) en la zona horaria del dispositivo. */
export function msUntilNextDay(now: Date): number {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime();
}

/** El lunes de la semana (lunes a domingo) que contiene `dateKey`. */
export function startOfWeek(dateKey: string): string {
  const weekday = (new Date(dayNumber(dateKey) * 86_400_000).getUTCDay() + 6) % 7; // 0 = lunes
  return addDays(dateKey, -weekday);
}

/** Las siete claves de la semana (lunes a domingo) que contiene `dateKey`. */
export function getWeekDays(dateKey: string): string[] {
  const monday = startOfWeek(dateKey);
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

/**
 * Rango de una semana en palabras: «12 – 18 de octubre de 2026», «28 de septiembre – 4 de octubre de 2026» o,
 * si cruza de año, «29 de diciembre de 2025 – 4 de enero de 2026».
 */
export function formatWeekLabel(dateKey: string): string {
  const days = getWeekDays(dateKey);
  const first = monthOf(days[0]);
  const last = monthOf(days[6]);
  const day = (key: string) => Number(key.slice(8));
  const monthName = ({ year, month }: YearMonth) => dayjs(new Date(year, month - 1, 1)).locale('es').format('MMMM');

  if (first.year !== last.year) {
    return `${day(days[0])} de ${monthName(first)} de ${first.year} – ${day(days[6])} de ${monthName(last)} de ${last.year}`;
  }
  if (first.month !== last.month) {
    return `${day(days[0])} de ${monthName(first)} – ${day(days[6])} de ${monthName(last)} de ${last.year}`;
  }
  return `${day(days[0])} – ${day(days[6])} de ${monthName(last)} de ${last.year}`;
}

/** El primer día del mes de `dateKey`. */
export function firstDayOfMonth(dateKey: string): string {
  const { year, month } = monthOf(dateKey);
  return toDayKey(year, month, 1);
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

/** «lun 12»: día de la semana abreviado y número del día. */
export function formatWeekdayAndDay(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  return dayjs(new Date(year, month - 1, day)).locale('es').format('ddd D').replace('.', '');
}

/** «oct»: nombre abreviado del mes (1 a 12). */
export function formatMonthShort(month: number): string {
  return dayjs(new Date(2026, month - 1, 1)).locale('es').format('MMM').replace('.', '');
}
