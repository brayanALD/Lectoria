import type { DailyGoal, GoalType } from '../types/goal';
import { formatDuration, formatPages } from './readingStats';

// Límites alineados con firestore.rules (validProfile → dailyGoalMinutes y dailyGoalPages).
export const GOAL_LIMITS: Record<GoalType, { min: number; max: number }> = {
  minutes: { min: 1, max: 1440 },
  pages: { min: 1, max: 10000 },
};

/** Nombre de cada tipo de meta, para elegirlo («Minutos», «Páginas»). */
export const GOAL_TYPE_LABELS: Record<GoalType, string> = { minutes: 'Minutos', pages: 'Páginas' };

const GOAL_UNITS: Record<GoalType, string> = { minutes: 'minutos', pages: 'páginas' };
const GOAL_NOUNS: Record<GoalType, string> = { minutes: 'los minutos', pages: 'las páginas' };

const INTEGER = /^\d+$/;

export type GoalInputResult = { ok: true; target: number } | { ok: false; error: string };

/** Valida lo escrito para la meta diaria: un entero dentro de los límites de ese tipo (minutos o páginas). */
export function parseGoalInput(text: string, type: GoalType): GoalInputResult {
  const trimmed = text.trim();
  const unit = GOAL_UNITS[type];
  if (!trimmed) return { ok: false, error: `Introduce ${GOAL_NOUNS[type]} de tu meta.` };
  const target = Number(trimmed);
  const { min, max } = GOAL_LIMITS[type];
  if (!INTEGER.test(trimmed) || target < min || target > max) {
    return { ok: false, error: `Introduce un número entero de ${unit} (de ${min} a ${max}).` };
  }
  return { ok: true, target };
}

/** «45 min» o «20 págs»: una cantidad de la meta con su unidad. */
export function formatGoalValue(type: GoalType, value: number): string {
  return type === 'minutes' ? formatDuration(value) : formatPages(value);
}

/** Lo leído en un día (los minutos y páginas de sus sesiones, ver `summarizeByDay`). */
export interface DayReading {
  minutes: number;
  pages: number;
}

export interface GoalProgressInfo {
  type: GoalType;
  /** Lo que hay que alcanzar (minutos o páginas, según `type`). */
  target: number;
  /** Lo leído ese día, medido en lo mismo que la meta. */
  value: number;
  /** 0–100, entero. Solo llega a 100 cuando la meta está cumplida (nunca redondea hacia arriba). */
  percent: number;
  /** Lo que falta para la meta; 0 si ya se cumplió. */
  remaining: number;
  met: boolean;
}

/** Cuánto de la meta diaria se ha cumplido con lo leído ese día. Mide minutos o páginas según el tipo de la meta. */
export function getGoalProgress(read: DayReading, goal: DailyGoal): GoalProgressInfo {
  const value = Math.max(0, goal.type === 'minutes' ? read.minutes : read.pages);
  const met = value >= goal.target;
  return {
    type: goal.type,
    target: goal.target,
    value,
    percent: met ? 100 : Math.floor((value / goal.target) * 100),
    remaining: met ? 0 : goal.target - value,
    met,
  };
}

/** «12 min de 30 min» o «8 págs de 20 págs». */
export function describeGoalSummary(progress: GoalProgressInfo): string {
  return `${formatGoalValue(progress.type, progress.value)} de ${formatGoalValue(progress.type, progress.target)}`;
}

/** «Meta cumplida», «Faltan 12 min» (o «Faltaron 12 min» si el día ya pasó). */
export function describeGoalProgress(progress: GoalProgressInfo, past = false): string {
  if (progress.met) return 'Meta cumplida';
  return `${past ? 'Faltaron' : 'Faltan'} ${formatGoalValue(progress.type, progress.remaining)}`;
}
