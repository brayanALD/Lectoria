import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ReadingSessionWithId } from '../../../types/session';
import { colors } from '../../../theme/colors';
import { iconSize, minTouchSize, opacity, spacing } from '../../../theme/spacing';
import { fontSize, fontWeight } from '../../../theme/typography';
import { formatDayLabel } from '../../../utils/calendar';
import { formatTotals, type PeriodTotals } from '../../../utils/readingStats';

interface DaySessionsProps {
  dateKey: string;
  todayKey: string;
  /** Sesiones de ese día, ya ordenadas. */
  sessions: readonly ReadingSessionWithId[];
  /** Título de cada libro por id (para mostrar de qué libro es cada sesión). */
  bookTitles: ReadonlyMap<string, string>;
  totals: Pick<PeriodTotals, 'minutes' | 'pages'>;
  onDelete: (session: ReadingSessionWithId) => void;
}

/** Detalle de un día: lo leído en total y cada sesión, con la opción de eliminarla. */
export function DaySessions({ dateKey, todayKey, sessions, bookTitles, totals, onDelete }: DaySessionsProps) {
  return (
    <View style={styles.container}>
      <View style={styles.heading}>
        <Text style={styles.day} accessibilityRole="header">
          {formatDayLabel(dateKey, todayKey)}
        </Text>
        <Text style={styles.totals}>{formatTotals(totals)}</Text>
      </View>

      {sessions.map((session) => {
        const title = bookTitles.get(session.bookId) ?? 'Libro eliminado';
        const detail = formatTotals({ minutes: session.durationMinutes, pages: session.pagesRead });
        return (
          <View key={session.id} style={styles.item}>
            <View style={styles.itemText}>
              <Text style={styles.title} numberOfLines={2}>
                {title}
              </Text>
              <Text style={styles.detail}>{detail}</Text>
              {session.notes ? <Text style={styles.notes}>{session.notes}</Text> : null}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Eliminar la sesión de ${title}`}
              onPress={() => onDelete(session)}
              style={({ pressed }) => [styles.delete, pressed && styles.pressed]}
            >
              <Ionicons name="trash-outline" size={iconSize.md} color={colors.error} />
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  heading: { gap: spacing.xs },
  day: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.textPrimary },
  totals: { fontSize: fontSize.md, color: colors.textSecondary },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  itemText: { flex: 1, gap: spacing.xs },
  title: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  detail: { fontSize: fontSize.sm, color: colors.textSecondary },
  notes: { fontSize: fontSize.sm, color: colors.textPrimary },
  delete: { width: minTouchSize, height: minTouchSize, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: opacity.pressed },
});
