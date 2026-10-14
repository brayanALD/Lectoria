import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PeriodHeader } from '../../../components/PeriodHeader';
import { colors } from '../../../theme/colors';
import { minTouchSize, opacity, radius, spacing } from '../../../theme/spacing';
import { fontSize, fontWeight, maxFontScale } from '../../../theme/typography';
import { addDays } from '../../../utils/readingDays';
import { formatDateKeyLong, formatWeekLabel, formatWeekdayAndDay, getWeekDays, startOfWeek } from '../../../utils/calendar';
import type { DaySummary } from '../../../utils/readingDays';
import { formatTotals, totalsForDays } from '../../../utils/readingStats';

interface WeekViewProps {
  /** Cualquier día de la semana que se muestra. */
  cursor: string;
  onCursorChange: (cursor: string) => void;
  todayKey: string;
  selectedKey?: string;
  days: ReadonlyMap<string, DaySummary>;
  onSelect: (dateKey: string) => void;
}

const BAR_HEIGHT = spacing.sm;

/** Semana de lunes a domingo: una fila por día con una barra proporcional a lo leído esa semana. */
export function WeekView({ cursor, onCursorChange, todayKey, selectedKey, days, onSelect }: WeekViewProps) {
  const weekDays = getWeekDays(cursor);
  const totals = totalsForDays(days, weekDays);
  const canGoNext = startOfWeek(cursor) < startOfWeek(todayKey);

  // La barra mide minutos; si en toda la semana solo hay páginas (sin minutos), mide páginas.
  const useMinutes = totals.minutes > 0;
  const value = (key: string) => (useMinutes ? days.get(key)?.minutes : days.get(key)?.pages) ?? 0;
  const max = Math.max(...weekDays.map(value), 1);

  return (
    <View style={styles.container}>
      <PeriodHeader
        label={formatWeekLabel(cursor)}
        onPrevious={() => onCursorChange(addDays(cursor, -7))}
        onNext={() => onCursorChange(addDays(cursor, 7))}
        canGoNext={canGoNext}
        previousLabel="Semana anterior"
        nextLabel="Semana siguiente"
      />
      <Text style={styles.totals}>{formatTotals(totals)}</Text>

      {weekDays.map((key) => {
        const day = days.get(key);
        const selected = key === selectedKey;
        const future = key > todayKey;
        const summary = day ? formatTotals(day) : 'Sin lectura';
        return (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityLabel={`${formatDateKeyLong(key)}${key === todayKey ? ', hoy' : ''}: ${summary}${day?.isReadingDay ? ', día de lectura' : ''}`}
            accessibilityState={{ selected, disabled: future }}
            disabled={future}
            onPress={() => onSelect(key)}
            style={({ pressed }) => [styles.row, selected && styles.rowSelected, future && styles.future, pressed && styles.pressed]}
          >
            <Text style={styles.dayLabel} maxFontSizeMultiplier={maxFontScale}>
              {formatWeekdayAndDay(key)}
            </Text>
            <View style={styles.barArea}>
              <View style={styles.track}>
                <View style={[styles.bar, { width: `${(value(key) / max) * 100}%` }]} />
              </View>
              <Text style={styles.summary} numberOfLines={1}>
                {day ? summary : '—'}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  totals: { fontSize: fontSize.md, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: minTouchSize,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  // El día elegido se distingue por el borde marcado (no solo por el color).
  rowSelected: { borderColor: colors.primary, borderWidth: 2 },
  future: { opacity: opacity.disabled },
  pressed: { opacity: opacity.pressed },
  dayLabel: { width: minTouchSize + spacing.sm, fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  barArea: { flex: 1, gap: spacing.xs },
  track: { height: BAR_HEIGHT, borderRadius: BAR_HEIGHT / 2, backgroundColor: colors.border, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: BAR_HEIGHT / 2, backgroundColor: colors.primary },
  summary: { fontSize: fontSize.sm, color: colors.textSecondary },
});
