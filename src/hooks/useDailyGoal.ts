import { useMemo } from 'react';

import { useReadingData } from '../context/ReadingDataContext';
import { getGoalProgress, type GoalProgressInfo } from '../utils/dailyGoal';

interface UseDailyGoalResult {
  /** La meta diaria en minutos, o `undefined` si no hay. */
  goalMinutes: number | undefined;
  /** Cuánto de la meta se ha cumplido HOY; `undefined` si no hay meta. */
  progress: GoalProgressInfo | undefined;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

/**
 * La meta diaria y el progreso de hoy. El progreso sale de los minutos de las sesiones de hoy (los mismos `days` que
 * usan el calendario y las rachas), así que se actualiza solo al registrar, editar o eliminar una sesión. Para
 * consultar otro día se usa `getGoalProgress` con los minutos de ese día.
 */
export function useDailyGoal(): UseDailyGoalResult {
  const { goal, days, todayKey } = useReadingData();
  const goalMinutes = goal.items[0];
  const todayMinutes = days.get(todayKey)?.minutes ?? 0;
  const progress = useMemo(
    () => (goalMinutes === undefined ? undefined : getGoalProgress(todayMinutes, goalMinutes)),
    [goalMinutes, todayMinutes],
  );
  return useMemo(
    () => ({ goalMinutes, progress, loading: goal.loading, error: goal.error, retry: goal.retry }),
    [goalMinutes, progress, goal.loading, goal.error, goal.retry],
  );
}
