import { useMemo } from 'react';

import { useReadingData } from '../context/ReadingDataContext';
import { computeStreaks, type DaySummary, type Streaks } from '../utils/readingDays';
import { toDateKey } from '../utils/session';

interface UseReadingStatsResult {
  /** Minutos y páginas por día (`dateKey`). */
  days: Map<string, DaySummary>;
  /** Días que cuentan como «día de lectura». */
  readingDays: Set<string>;
  /** Racha actual y récord, calculados con el día de hoy. */
  streaks: Streaks;
}

/**
 * Resúmenes derivados de las sesiones: días, días de lectura y rachas. Se calculan una sola vez en
 * `ReadingDataProvider` (las rachas, aquí, porque dependen del día de hoy), así Inicio, Calendario y el registro de
 * lecturas siempre muestran lo mismo.
 */
export function useReadingStats(): UseReadingStatsResult {
  const { days, readingDays } = useReadingData();
  const todayKey = toDateKey(new Date());
  const streaks = useMemo(() => computeStreaks(readingDays, todayKey), [readingDays, todayKey]);
  return useMemo(() => ({ days, readingDays, streaks }), [days, readingDays, streaks]);
}
