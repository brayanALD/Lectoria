// Límites alineados con firestore.rules (validProfile → monthlyBooksGoal).
export const MONTHLY_BOOKS_GOAL_LIMITS = { min: 1, max: 1000 } as const;

const INTEGER = /^\d+$/;

export type MonthlyGoalInputResult = { ok: true; target: number } | { ok: false; error: string };

/** Valida lo escrito para el objetivo mensual: un número entero de libros dentro de los límites. */
export function parseMonthlyGoalInput(text: string): MonthlyGoalInputResult {
  const trimmed = text.trim();
  const { min, max } = MONTHLY_BOOKS_GOAL_LIMITS;
  if (!trimmed) return { ok: false, error: 'Introduce el número de libros de tu objetivo.' };
  const target = Number(trimmed);
  if (!INTEGER.test(trimmed) || target < min || target > max) {
    return { ok: false, error: `Introduce un número entero de libros (de ${min} a ${max}).` };
  }
  return { ok: true, target };
}

/** «1 libro» o «3 libros». */
export function formatBooks(count: number): string {
  return `${count} ${count === 1 ? 'libro' : 'libros'}`;
}

export interface MonthlyGoalProgressInfo {
  /** Libros que hay que terminar en el mes. */
  target: number;
  /** Libros terminados en el mes. */
  value: number;
  /** 0–100, entero. Solo llega a 100 cuando el objetivo está cumplido (nunca redondea hacia arriba). */
  percent: number;
  /** Libros que faltan para el objetivo; 0 si ya se cumplió. */
  remaining: number;
  met: boolean;
}

/** Cuánto del objetivo mensual se ha cumplido con los libros terminados en ese mes (ver `countFinishedBooks`). */
export function getMonthlyGoalProgress(finishedBooks: number, target: number): MonthlyGoalProgressInfo {
  const value = Math.max(0, finishedBooks);
  const met = value >= target;
  return {
    target,
    value,
    percent: met ? 100 : Math.floor((value / target) * 100),
    remaining: met ? 0 : target - value,
    met,
  };
}

/** «2 de 5 libros». */
export function describeMonthlyGoalSummary(progress: MonthlyGoalProgressInfo): string {
  return `${progress.value} de ${formatBooks(progress.target)}`;
}

/** «Objetivo cumplido», «Falta 1 libro», «Faltan 3 libros» (o «Faltó» y «Faltaron» si el mes ya pasó). */
export function describeMonthlyGoalProgress(progress: MonthlyGoalProgressInfo, past = false): string {
  if (progress.met) return 'Objetivo cumplido';
  const one = progress.remaining === 1;
  const verb = past ? (one ? 'Faltó' : 'Faltaron') : one ? 'Falta' : 'Faltan';
  return `${verb} ${formatBooks(progress.remaining)}`;
}
