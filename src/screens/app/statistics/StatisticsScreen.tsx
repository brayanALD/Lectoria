import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Chip } from '../../../components/Chip';
import { DailyGoalSheet } from '../../../components/DailyGoalSheet';
import { EmptyState } from '../../../components/EmptyState';
import { GoalProgress } from '../../../components/GoalProgress';
import { PeriodHeader } from '../../../components/PeriodHeader';
import { ReadingProgress } from '../../../components/ReadingProgress';
import { SetGoalLink } from '../../../components/SetGoalLink';
import { StatisticsSkeleton } from '../../../components/StatisticsSkeleton';
import { useBooks } from '../../../hooks/useBooks';
import { useDailyGoal } from '../../../hooks/useDailyGoal';
import { useMonthlyBooksGoal } from '../../../hooks/useMonthlyBooksGoal';
import { useReadingStats } from '../../../hooks/useReadingStats';
import { useSaveDailyGoal } from '../../../hooks/useSaveDailyGoal';
import { useSaveMonthlyBooksGoal } from '../../../hooks/useSaveMonthlyBooksGoal';
import { useSessions } from '../../../hooks/useSessions';
import type { AppStackParamList } from '../../../navigation/types';
import { makeStyles, useTheme } from '../../../context/ThemeContext';
import { iconSize, opacity, radius, spacing } from '../../../theme/spacing';
import { fontFamily, fontSize } from '../../../theme/typography';
import {
  addMonths,
  compareMonths,
  cursorForMonth,
  formatDayLabel,
  formatMonthLabel,
  monthOf,
} from '../../../utils/calendar';
import { formatGoalValue } from '../../../utils/dailyGoal';
import { getMonthlyGoalProgress } from '../../../utils/monthlyGoal';
import { addDays } from '../../../utils/readingDays';
import { formatDuration } from '../../../utils/readingStats';
import { chartMetric, countFinishedBooks, describeMonthChart, summarizeDay, summarizeMonth } from '../../../utils/statistics';
import { DailyBars } from './DailyBars';
import { MonthlyGoalProgress } from './MonthlyGoalProgress';
import { MonthlyGoalSheet } from './MonthlyGoalSheet';
import { StatTile } from './StatTile';

type Mode = 'day' | 'month';

const MODES: { mode: Mode; label: string }[] = [
  { mode: 'day', label: 'Día' },
  { mode: 'month', label: 'Mes' },
];

/**
 * Estadísticas de lectura por día y por mes. Todo se deriva de las mismas sesiones y libros que usan Inicio, el
 * Calendario y el detalle del libro (fuente única), así que se actualiza solo al registrar, editar o eliminar una
 * sesión. La meta diaria, en minutos o en páginas, se integra en las dos vistas y el objetivo mensual de libros, en la del mes.
 */
export function StatisticsScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const sessions = useSessions();
  const books = useBooks();
  const goalState = useDailyGoal();
  const { days, streaks, todayKey } = useReadingStats();
  const saveGoal = useSaveDailyGoal();
  const monthlyGoalState = useMonthlyBooksGoal();
  const saveMonthlyGoal = useSaveMonthlyBooksGoal();
  const { goal } = goalState;
  const monthlyGoal = monthlyGoalState.goal;

  const [mode, setMode] = useState<Mode>('month');
  // `cursor` fija el periodo que se ve (un día o el mes que lo contiene) y se conserva al cambiar de vista.
  const [cursor, setCursor] = useState(todayKey);
  const [editingGoal, setEditingGoal] = useState(false);
  const [editingMonthlyGoal, setEditingMonthlyGoal] = useState(false);

  const today = monthOf(todayKey);
  const cursorMonth = monthOf(cursor);

  const dayStats = useMemo(() => summarizeDay(days, cursor, goal), [days, cursor, goal]);
  const monthStats = useMemo(() => summarizeMonth(days, monthOf(cursor), todayKey, goal), [days, cursor, todayKey, goal]);
  const finishedBooks = useMemo(() => countFinishedBooks(books.books, monthOf(cursor)), [books.books, cursor]);
  // El objetivo mensual se compara con los libros terminados del mes que se ve (hoy, el actual).
  const monthlyProgress = useMemo(
    () => (monthlyGoal === undefined ? undefined : getMonthlyGoalProgress(finishedBooks, monthlyGoal)),
    [finishedBooks, monthlyGoal],
  );

  if (sessions.loading || books.loading || goalState.loading || monthlyGoalState.loading) return <StatisticsSkeleton />;

  if (sessions.error && sessions.sessions.length === 0) {
    return (
      <EmptyState
        icon="cloud-offline-outline"
        title="No se pudieron cargar las estadísticas"
        description={sessions.error}
        action={{
          label: 'Reintentar',
          onPress: () => {
            sessions.retry();
            books.retry();
            goalState.retry();
            monthlyGoalState.retry();
          },
        }}
      />
    );
  }

  // Sin una sola lectura registrada (ni libros terminados) no hay nada que resumir.
  if (sessions.sessions.length === 0 && !books.books.some((book) => book.status === 'finished')) {
    return (
      <EmptyState
        icon="stats-chart-outline"
        title="Registra tu primera lectura"
        action={{ label: 'Registrar lectura', onPress: () => navigation.navigate('AddSession') }}
      />
    );
  }

  const isCurrentPeriod = mode === 'day' ? cursor === todayKey : compareMonths(cursorMonth, today) === 0;
  const canGoNext = mode === 'day' ? cursor < todayKey : compareMonths(cursorMonth, today) < 0;
  const move = (delta: -1 | 1) =>
    setCursor(mode === 'day' ? addDays(cursor, delta) : cursorForMonth(addMonths(cursorMonth, delta), todayKey));

  const metric = chartMetric(goal);
  const openGoalEditor = () => setEditingGoal(true);
  const openMonthlyGoalEditor = () => setEditingMonthlyGoal(true);

  return (
    <>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.switch}>
          {MODES.map((option) => (
            <View key={option.mode} style={styles.switchItem}>
              <Chip label={option.label} selected={mode === option.mode} onPress={() => setMode(option.mode)} />
            </View>
          ))}
          {!isCurrentPeriod ? (
            <View style={styles.switchItem}>
              <Chip label="Hoy" selected={false} onPress={() => setCursor(todayKey)} accessibilityLabel="Volver a hoy" />
            </View>
          ) : null}
        </View>

        <PeriodHeader
          label={mode === 'day' ? formatDayLabel(cursor, todayKey) : formatMonthLabel(cursorMonth)}
          onPrevious={() => move(-1)}
          onNext={() => move(1)}
          canGoNext={canGoNext}
          previousLabel={mode === 'day' ? 'Día anterior' : 'Mes anterior'}
          nextLabel={mode === 'day' ? 'Día siguiente' : 'Mes siguiente'}
        />

        {mode === 'day' ? (
          <>
            <View style={styles.tiles}>
              <StatTile label="Tiempo" value={formatDuration(dayStats.minutes)} />
              <StatTile label="Páginas" value={String(dayStats.pages)} />
              <StatTile label="Sesiones" value={String(dayStats.sessions)} />
            </View>
            {dayStats.progress ? (
              <GoalProgress progress={dayStats.progress} past={cursor < todayKey} onPress={openGoalEditor} />
            ) : (
              <SetGoalLink onPress={openGoalEditor} />
            )}
          </>
        ) : (
          <>
            <View style={styles.tiles}>
              <StatTile label="Tiempo" value={formatDuration(monthStats.totals.minutes)} />
              <StatTile label="Páginas" value={String(monthStats.totals.pages)} />
            </View>
            <View style={styles.tiles}>
              <StatTile label="Días de lectura" value={`${monthStats.totals.readingDays} de ${monthStats.elapsedDays}`} />
              <StatTile label="Libros terminados" value={String(finishedBooks)} />
            </View>

            <View style={styles.section}>
              <Text style={styles.heading} accessibilityRole="header">
                {metric === 'pages' ? 'Páginas por día' : 'Minutos por día'}
              </Text>
              <DailyBars
                points={monthStats.points}
                goalValue={goal?.target}
                accessibilityLabel={describeMonthChart(monthStats, metric)}
              />
            </View>

            {goal && monthStats.goal ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Meta diaria de ${formatGoalValue(goal.type, goal.target)}: cumplida ${monthStats.goal.daysMet} de ${monthStats.elapsedDays} días`}
                accessibilityHint="Toca para cambiar la meta"
                onPress={openGoalEditor}
                style={({ pressed }) => [styles.section, pressed && styles.pressed]}
              >
                <View style={styles.goalRow}>
                  <Text style={styles.goalTitle}>
                    Meta cumplida {monthStats.goal.daysMet} de {monthStats.elapsedDays}{' '}
                    {monthStats.elapsedDays === 1 ? 'día' : 'días'}
                  </Text>
                  <Ionicons name="create-outline" size={iconSize.md} color={colors.primary} accessible={false} />
                </View>
                <ReadingProgress
                  percent={monthStats.goal.percent}
                  accessibilityLabel="Cumplimiento de la meta"
                  valueText={`${monthStats.goal.daysMet} de ${monthStats.elapsedDays} días`}
                />
                <Text style={styles.goalTarget}>Meta diaria: {formatGoalValue(goal.type, goal.target)}</Text>
              </Pressable>
            ) : (
              <SetGoalLink onPress={openGoalEditor} />
            )}

            {monthlyProgress ? (
              <MonthlyGoalProgress
                progress={monthlyProgress}
                past={compareMonths(cursorMonth, today) < 0}
                onPress={openMonthlyGoalEditor}
              />
            ) : (
              <SetGoalLink label="Fijar objetivo mensual" onPress={openMonthlyGoalEditor} />
            )}

            {streaks.longest > 0 ? (
              <Text style={styles.streak} accessibilityLabel={describeStreaks(streaks.current, streaks.longest)}>
                Racha: {streaks.current} {streaks.current === 1 ? 'día' : 'días'} · Récord: {streaks.longest}
              </Text>
            ) : null}
          </>
        )}
      </ScrollView>

      <DailyGoalSheet visible={editingGoal} onClose={() => setEditingGoal(false)} goal={goal} onSave={saveGoal} />
      <MonthlyGoalSheet
        visible={editingMonthlyGoal}
        onClose={() => setEditingMonthlyGoal(false)}
        goal={monthlyGoal}
        onSave={saveMonthlyGoal}
      />
    </>
  );
}

/** Frase completa para el lector de pantalla. */
function describeStreaks(current: number, longest: number): string {
  const days = (count: number) => `${count} ${count === 1 ? 'día' : 'días'}`;
  return `Racha actual de ${days(current)}. Récord de ${days(longest)}.`;
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl * 2 },
  switch: { flexDirection: 'row', gap: spacing.sm },
  switchItem: { flex: 1 },
  tiles: { flexDirection: 'row', gap: spacing.sm },
  section: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceTint },
  heading: { fontSize: fontSize.lg, fontFamily: fontFamily.display, color: colors.textPrimary },
  goalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
  goalTitle: { flex: 1, fontSize: fontSize.md, fontFamily: fontFamily.regular, color: colors.textPrimary },
  goalTarget: { fontSize: fontSize.sm, fontFamily: fontFamily.regular, color: colors.textSecondary },
  streak: { fontSize: fontSize.md, fontFamily: fontFamily.regular, color: colors.textSecondary, textAlign: 'center' },
  pressed: { opacity: opacity.pressed },
}));
