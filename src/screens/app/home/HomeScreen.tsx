import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '../../../components/EmptyState';
import { GoalProgress } from '../../../components/GoalProgress';
import { HomeSkeleton } from '../../../components/HomeSkeleton';
import { SessionRow } from '../../../components/SessionRow';
import { useAuth } from '../../../context/AuthContext';
import { useBooks } from '../../../hooks/useBooks';
import { useDailyGoal } from '../../../hooks/useDailyGoal';
import { useReadingStats } from '../../../hooks/useReadingStats';
import { useSessions } from '../../../hooks/useSessions';
import type { AppStackParamList } from '../../../navigation/types';
import { setDailyGoal } from '../../../services/userService';
import { colors } from '../../../theme/colors';
import { iconSize, minTouchSize, opacity, spacing } from '../../../theme/spacing';
import { fontSize, fontWeight } from '../../../theme/typography';
import { formatDayLabel } from '../../../utils/calendar';
import { formatTotals } from '../../../utils/readingStats';
import { withTimeout } from '../../../utils/withTimeout';
import { DailyGoalSheet } from './DailyGoalSheet';
import { ReadingActions } from './ReadingActions';

// Tamaño de la cifra de la racha: lo más grande de la app, es lo primero que debe leerse en Inicio.
const STREAK_NUMBER_SCALE = 2;
// Cuántas lecturas se muestran en «Actividad reciente».
const RECENT_ACTIVITY_COUNT = 5;
// Sin conexión, una escritura de Firestore no termina hasta recuperar la red: se corta la espera.
const WRITE_TIMEOUT_MS = 10000;

export function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { user } = useAuth();
  const books = useBooks();
  const sessions = useSessions();
  const goal = useDailyGoal();
  const { streaks, todayKey } = useReadingStats();
  const [editingGoal, setEditingGoal] = useState(false);

  const bookTitles = useMemo(() => new Map(books.books.map((book) => [book.id, book.title])), [books.books]);

  if (books.loading || sessions.loading || goal.loading) return <HomeSkeleton />;

  const error = books.error ?? sessions.error;
  if (error && books.books.length === 0) {
    return (
      <EmptyState
        icon="cloud-offline-outline"
        title="No se pudo cargar tu información"
        description={error}
        action={{
          label: 'Reintentar',
          onPress: () => {
            books.retry();
            sessions.retry();
            goal.retry();
          },
        }}
      />
    );
  }

  if (books.books.length === 0) {
    return (
      <EmptyState
        icon="library-outline"
        title="Añade tu primer libro"
        action={{ label: 'Añadir libro', onPress: () => navigation.navigate('AddBook') }}
      />
    );
  }

  const recent = sessions.sessions.slice(0, RECENT_ACTIVITY_COUNT);

  return (
    <>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.streak} accessible accessibilityLabel={describeStreak(streaks.current, streaks.longest)}>
          <Text style={styles.number}>{streaks.current}</Text>
          <Text style={styles.caption}>{streaks.current === 1 ? 'día seguido' : 'días seguidos'}</Text>
          {streaks.longest > streaks.current ? <Text style={styles.record}>Récord: {streaks.longest}</Text> : null}
        </View>

        {goal.progress ? (
          <GoalProgress progress={goal.progress} onPress={() => setEditingGoal(true)} />
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fijar meta diaria"
            onPress={() => setEditingGoal(true)}
            style={({ pressed }) => [styles.setGoal, pressed && styles.pressed]}
          >
            <Ionicons name="flag-outline" size={iconSize.md} color={colors.primary} accessible={false} />
            <Text style={styles.setGoalLabel}>Fijar meta diaria</Text>
          </Pressable>
        )}

        <ReadingActions onRegister={() => navigation.navigate('AddSession')} onOpenTimer={() => navigation.navigate('Timer')} />

        <View style={styles.activity}>
          <Text style={styles.heading} accessibilityRole="header">
            Actividad reciente
          </Text>
          {recent.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="book-outline" size={iconSize.xl} color={colors.textSecondary} accessible={false} />
              <Text style={styles.emptyTitle}>Aún no has registrado lecturas</Text>
            </View>
          ) : (
            recent.map((session) => {
              const title = bookTitles.get(session.bookId);
              const totals = formatTotals({ minutes: session.durationMinutes, pages: session.pagesRead });
              return (
                <SessionRow
                  key={session.id}
                  title={title ?? 'Libro eliminado'}
                  detail={`${formatDayLabel(session.dateKey, todayKey)} · ${totals}`}
                  onPress={title ? () => navigation.navigate('BookDetail', { bookId: session.bookId }) : undefined}
                />
              );
            })
          )}
        </View>

        {error ? (
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
      </ScrollView>

      <DailyGoalSheet
        visible={editingGoal}
        onClose={() => setEditingGoal(false)}
        goal={goal.goal}
        onSave={async (nextGoal) => {
          if (!user) throw new Error('No hay sesión iniciada');
          await withTimeout(setDailyGoal(user.uid, nextGoal), WRITE_TIMEOUT_MS);
        }}
      />
    </>
  );
}

/** Frase completa para el lector de pantalla (la cifra y su leyenda se leen como una sola cosa). */
function describeStreak(current: number, longest: number): string {
  const days = (count: number) => `${count} ${count === 1 ? 'día seguido' : 'días seguidos'}`;
  return longest > current ? `Racha de ${days(current)}. Récord: ${longest}.` : `Racha de ${days(current)}.`;
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xl * 2 },
  streak: { alignItems: 'center', gap: spacing.xs },
  number: { fontSize: fontSize.xl * STREAK_NUMBER_SCALE, fontWeight: fontWeight.bold, color: colors.primary },
  caption: { fontSize: fontSize.lg, color: colors.textPrimary },
  record: { fontSize: fontSize.sm, color: colors.textSecondary },
  setGoal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: minTouchSize,
  },
  setGoalLabel: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.primary },
  pressed: { opacity: opacity.pressed },
  activity: { gap: spacing.sm },
  heading: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.textPrimary },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  emptyTitle: { fontSize: fontSize.md, color: colors.textSecondary, textAlign: 'center' },
  error: { fontSize: fontSize.sm, color: colors.error },
});
