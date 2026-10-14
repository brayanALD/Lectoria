import { useMemo } from 'react';

import { useReadingData } from '../context/ReadingDataContext';
import { computeStreaks, type DaySummary, type Streaks } from '../utils/readingDays';

interface UseReadingStatsResult {
  /** Minutos y páginas por día (`dateKey`). */
  days: Map<string, DaySummary>;
  /** Días que cuentan como «día de lectura». */
  readingDays: Set<string>;
  /** Racha actual y récord, calculados con el día de hoy. */
  streaks: Streaks;
  /** «YYYY-MM-DD» de hoy: el mismo para todas las pantallas y puesto al día a medianoche. */
  todayKey: string;
}

/**
 * Resúmenes derivados de las sesiones: días, días de lectura, rachas y el día de hoy. Los días se calculan una sola
 * vez en `ReadingDataProvider` (las rachas, aquí, porque dependen de hoy), así Inicio, Calendario y el registro de
 * lecturas siempre muestran lo mismo.
 */
export function useReadingStats(): UseReadingStatsResult {
  const { days, readingDays, todayKey } = useReadingData();
  const streaks = useMemo(() => computeStreaks(readingDays, todayKey), [readingDays, todayKey]);
  return useMemo(() => ({ days, readingDays, streaks, todayKey }), [days, readingDays, streaks, todayKey]);
}
