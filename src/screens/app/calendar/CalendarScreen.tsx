import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { CalendarSkeleton } from '../../../components/CalendarSkeleton';
import { Chip } from '../../../components/Chip';
import { EmptyState } from '../../../components/EmptyState';
import { MonthCalendar } from '../../../components/MonthCalendar';
import { useBooks } from '../../../hooks/useBooks';
import { useDailyGoal } from '../../../hooks/useDailyGoal';
import { useDeleteSession } from '../../../hooks/useDeleteSession';
import { useReadingStats } from '../../../hooks/useReadingStats';
import { useSessions } from '../../../hooks/useSessions';
import type { AppStackParamList } from '../../../navigation/types';
import { colors } from '../../../theme/colors';
import { spacing } from '../../../theme/spacing';
import { fontSize } from '../../../theme/typography';
import {
  compareMonths,
  monthOf,
  startOfWeek,
  toDayKey,
  type YearMonth,
} from '../../../utils/calendar';
import { DaySessions } from './DaySessions';
import { WeekView } from './WeekView';
import { YearView } from './YearView';

type ViewMode = 'week' | 'month' | 'year';

const VIEWS: { mode: ViewMode; label: string }[] = [
  { mode: 'week', label: 'Semana' },
  { mode: 'month', label: 'Mes' },
  { mode: 'year', label: 'Año' },
];

export function CalendarScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { sessions, loading, error, retry } = useSessions();
  const { books, loading: booksLoading } = useBooks();
  const { days, readingDays, todayKey } = useReadingStats();
  const { goal } = useDailyGoal();
  const { confirmDelete, error: actionError } = useDeleteSession();

  const today = monthOf(todayKey);

  const [mode, setMode] = useState<ViewMode>('month');
  // `cursor` fija el periodo que se ve (mes, semana o año) y se conserva al cambiar de vista.
  const [cursor, setCursor] = useState(todayKey);
  const [selectedKey, setSelectedKey] = useState<string | undefined>(todayKey);

  const bookTitles = useMemo(() => new Map(books.map((book) => [book.id, book.title])), [books]);

  // Hoy cae en el mes actual; el resto de meses se abren en su día 1.
  const cursorForMonth = (month: YearMonth) => (compareMonths(month, today) === 0 ? todayKey : toDayKey(month.year, month.month, 1));

  const cursorMonth = monthOf(cursor);
  const isCurrentPeriod =
    mode === 'month'
      ? compareMonths(cursorMonth, today) === 0
      : mode === 'week'
        ? startOfWeek(cursor) === startOfWeek(todayKey)
        : cursorMonth.year === today.year;

  // El detalle solo se muestra si el día elegido está dentro del periodo visible.
  const detailKey =
    selectedKey &&
    ((mode === 'month' && compareMonths(monthOf(selectedKey), cursorMonth) === 0) ||
      (mode === 'week' && startOfWeek(selectedKey) === startOfWeek(cursor)))
      ? selectedKey
      : undefined;

  const daySessions = useMemo(
    () =>
      detailKey
        ? sessions.filter((session) => session.dateKey === detailKey).sort((a, b) => a.date.toMillis() - b.date.toMillis())
        : [],
    [sessions, detailKey],
  );

  const goToday = () => {
    setCursor(todayKey);
    setSelectedKey(todayKey);
  };

  // Los títulos de cada sesión vienen de los libros: se espera a ambas listas para no mostrar «Libro eliminado» de más.
  if (loading || booksLoading) return <CalendarSkeleton />;

  if (error && sessions.length === 0) {
    return (
      <EmptyState
        icon="cloud-offline-outline"
        title="No se pudo cargar el calendario"
        description={error}
        action={{ label: 'Reintentar', onPress: retry }}
      />
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.switch}>
        {VIEWS.map((view) => (
          <View key={view.mode} style={styles.switchItem}>
            <Chip label={view.label} selected={mode === view.mode} onPress={() => setMode(view.mode)} />
          </View>
        ))}
        {!isCurrentPeriod ? (
          <View style={styles.switchItem}>
            <Chip label="Hoy" selected={false} onPress={goToday} accessibilityLabel="Volver a hoy" />
          </View>
        ) : null}
      </View>

      {mode === 'month' ? (
        <MonthCalendar
          month={cursorMonth}
          onMonthChange={(month) => setCursor(cursorForMonth(month))}
          todayKey={todayKey}
          selectedKey={selectedKey}
          markedDays={readingDays}
          maxKey={todayKey}
          onSelect={setSelectedKey}
        />
      ) : null}

      {mode === 'week' ? (
        <WeekView
          cursor={cursor}
          onCursorChange={setCursor}
          todayKey={todayKey}
          selectedKey={selectedKey}
          days={days}
          goal={goal}
          onSelect={setSelectedKey}
        />
      ) : null}

      {mode === 'year' ? (
        <YearView
          year={cursorMonth.year}
          onYearChange={(year) => {
            const month = Math.min(cursorMonth.month, year === today.year ? today.month : 12);
            setCursor(cursorForMonth({ year, month }));
          }}
          today={today}
          days={days}
          onSelectMonth={(year, month) => {
            setMode('month');
            setCursor(cursorForMonth({ year, month }));
            setSelectedKey(compareMonths({ year, month }, today) === 0 ? todayKey : undefined);
          }}
        />
      ) : null}

      {detailKey ? (
        <DaySessions
          dateKey={detailKey}
          todayKey={todayKey}
          sessions={daySessions}
          bookTitles={bookTitles}
          totals={days.get(detailKey) ?? { minutes: 0, pages: 0 }}
          goal={goal}
          onRegister={detailKey <= todayKey ? () => navigation.navigate('AddSession', { day: detailKey }) : undefined}
          onEdit={(session) => navigation.navigate('AddSession', { sessionId: session.id })}
          onDelete={confirmDelete}
        />
      ) : null}

      {actionError ? (
        <Text style={styles.error} accessibilityRole="alert">
          {actionError}
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl * 2 },
  switch: { flexDirection: 'row', gap: spacing.sm },
  switchItem: { flex: 1 },
  error: { fontSize: fontSize.sm, color: colors.error },
});
