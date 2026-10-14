import { useMemo } from 'react';

import { useReadingData } from '../context/ReadingDataContext';
import type { DailyGoal } from '../types/goal';
import { getGoalProgress, type GoalProgressInfo } from '../utils/dailyGoal';

interface UseDailyGoalResult {
  /** La meta diaria (minutos o páginas), o `undefined` si no hay. */
  goal: DailyGoal | undefined;
  /** Cuánto de la meta se ha cumplido HOY; `undefined` si no hay meta. */
  progress: GoalProgressInfo | undefined;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

/**
 * La meta diaria y el progreso de hoy. El progreso sale de lo leído hoy (los mismos `days` que usan el calendario y
 * las rachas) y se mide en lo que pida la meta, minutos o páginas, así que se actualiza solo al registrar, editar o
 * eliminar una sesión, a mano o con el cronómetro. Para consultar otro día se usa `getGoalProgress` con lo leído ese día.
 */
export function useDailyGoal(): UseDailyGoalResult {
  const { goal: liveGoal, days, todayKey } = useReadingData();
  const goal = liveGoal.items[0];
  const today = days.get(todayKey);
  const minutes = today?.minutes ?? 0;
  const pages = today?.pages ?? 0;
  const progress = useMemo(() => (goal ? getGoalProgress({ minutes, pages }, goal) : undefined), [goal, minutes, pages]);
  return useMemo(
    () => ({ goal, progress, loading: liveGoal.loading, error: liveGoal.error, retry: liveGoal.retry }),
    [goal, progress, liveGoal.loading, liveGoal.error, liveGoal.retry],
  );
}
