import { formatDuration } from './readingStats';

// Límites alineados con firestore.rules (validProfile → dailyGoalMinutes).
export const MIN_DAILY_GOAL_MINUTES = 1;
export const MAX_DAILY_GOAL_MINUTES = 1440;

const INTEGER = /^\d+$/;

export type GoalInputResult = { ok: true; minutes: number } | { ok: false; error: string };

/** Valida los minutos escritos para la meta diaria: un entero de 1 a 1440. */
export function parseGoalInput(text: string): GoalInputResult {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: 'Introduce los minutos de tu meta.' };
  const minutes = Number(trimmed);
  if (!INTEGER.test(trimmed) || minutes < MIN_DAILY_GOAL_MINUTES || minutes > MAX_DAILY_GOAL_MINUTES) {
    return { ok: false, error: `Introduce un número entero de minutos (de ${MIN_DAILY_GOAL_MINUTES} a ${MAX_DAILY_GOAL_MINUTES}).` };
  }
  return { ok: true, minutes };
}

export interface GoalProgressInfo {
  goalMinutes: number;
  /** Minutos leídos ese día. */
  minutes: number;
  /** 0–100, entero. Solo llega a 100 cuando la meta está cumplida (nunca redondea hacia arriba). */
  percent: number;
  /** Minutos que faltan para la meta; 0 si ya se cumplió. */
  remaining: number;
  met: boolean;
}

/** Cuánto de la meta diaria se ha cumplido con los minutos leídos ese día. */
export function getGoalProgress(minutes: number, goalMinutes: number): GoalProgressInfo {
  const read = Math.max(0, minutes);
  const met = read >= goalMinutes;
  return {
    goalMinutes,
    minutes: read,
    percent: met ? 100 : Math.floor((read / goalMinutes) * 100),
    remaining: met ? 0 : goalMinutes - read,
    met,
  };
}

/** «Meta cumplida», «Faltan 12 min» (o «Faltaron 12 min» si el día ya pasó). */
export function describeGoalProgress(progress: GoalProgressInfo, past = false): string {
  if (progress.met) return 'Meta cumplida';
  return `${past ? 'Faltaron' : 'Faltan'} ${formatDuration(progress.remaining)}`;
}
