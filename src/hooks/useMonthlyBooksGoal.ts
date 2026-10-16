import { useMemo } from 'react';

import { useReadingData } from '../context/ReadingDataContext';

interface UseMonthlyBooksGoalResult {
  /** El objetivo mensual: cuántos libros terminar al mes, o `undefined` si no hay. */
  goal: number | undefined;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

/**
 * El objetivo mensual de libros. Lo que se ha cumplido no se guarda: se deriva de los libros terminados de cada mes
 * (`countFinishedBooks`), así que siempre coincide con la biblioteca.
 */
export function useMonthlyBooksGoal(): UseMonthlyBooksGoalResult {
  const { monthlyGoal } = useReadingData();
  return useMemo(
    () => ({ goal: monthlyGoal.items[0], loading: monthlyGoal.loading, error: monthlyGoal.error, retry: monthlyGoal.retry }),
    [monthlyGoal.items, monthlyGoal.loading, monthlyGoal.error, monthlyGoal.retry],
  );
}
