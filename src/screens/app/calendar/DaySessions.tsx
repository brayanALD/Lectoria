import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../../../components/Button';
import { GoalProgress } from '../../../components/GoalProgress';
import { SessionRow } from '../../../components/SessionRow';
import type { ReadingSessionWithId } from '../../../types/session';
import type { DailyGoal } from '../../../types/goal';
import { colors } from '../../../theme/colors';
import { spacing } from '../../../theme/spacing';
import { fontSize, fontWeight } from '../../../theme/typography';
import { formatDayLabel } from '../../../utils/calendar';
import { getGoalProgress } from '../../../utils/dailyGoal';
import { formatTotals, type PeriodTotals } from '../../../utils/readingStats';

interface DaySessionsProps {
  dateKey: string;
  todayKey: string;
  /** Sesiones de ese día, ya ordenadas. */
  sessions: readonly ReadingSessionWithId[];
  /** Título de cada libro por id (para mostrar de qué libro es cada sesión). */
  bookTitles: ReadonlyMap<string, string>;
  totals: Pick<PeriodTotals, 'minutes' | 'pages'>;
  /** La meta diaria (minutos o páginas); sin ella no se muestra el cumplimiento. */
  goal?: DailyGoal;
  /** Registrar una lectura en este día. Ausente en días futuros, donde no se puede registrar. */
  onRegister?: () => void;
  onEdit: (session: ReadingSessionWithId) => void;
  onDelete: (session: ReadingSessionWithId) => void;
}

/** Detalle de un día: lo leído en total, la meta, cada sesión (editar o eliminar) y registrar una lectura ese día. */
export function DaySessions({
  dateKey,
  todayKey,
  sessions,
  bookTitles,
  totals,
  goal,
  onRegister,
  onEdit,
  onDelete,
}: DaySessionsProps) {
  return (
    <View style={styles.container}>
      <View style={styles.heading}>
        <Text style={styles.day} accessibilityRole="header">
          {formatDayLabel(dateKey, todayKey)}
        </Text>
        <Text style={styles.totals}>{formatTotals(totals)}</Text>
      </View>

      {goal ? <GoalProgress progress={getGoalProgress(totals, goal)} past={dateKey < todayKey} /> : null}

      {sessions.map((session) => {
        const title = bookTitles.get(session.bookId) ?? 'Libro eliminado';
        return (
          <SessionRow
            key={session.id}
            title={title}
            detail={formatTotals({ minutes: session.durationMinutes, pages: session.pagesRead })}
            notes={session.notes}
            onEdit={() => onEdit(session)}
            onDelete={() => onDelete(session)}
          />
        );
      })}

      {onRegister ? <Button title="Registrar lectura" variant="secondary" onPress={onRegister} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  heading: { gap: spacing.xs },
  day: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.textPrimary },
  totals: { fontSize: fontSize.md, color: colors.textSecondary },
});
