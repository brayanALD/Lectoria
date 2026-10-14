import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PeriodHeader } from '../../../components/PeriodHeader';
import { colors } from '../../../theme/colors';
import { minTouchSize, opacity, radius, spacing } from '../../../theme/spacing';
import { fontSize, fontWeight, maxFontScale } from '../../../theme/typography';
import { formatMonthLabel, formatMonthShort } from '../../../utils/calendar';
import type { DaySummary } from '../../../utils/readingDays';
import { formatTotals, summarizeYear } from '../../../utils/readingStats';

interface YearViewProps {
  year: number;
  onYearChange: (year: number) => void;
  /** Año y mes de hoy: los meses posteriores no se pueden abrir. */
  today: { year: number; month: number };
  days: ReadonlyMap<string, DaySummary>;
  onSelectMonth: (year: number, month: number) => void;
}

const BAR_HEIGHT = spacing.sm;
const COLUMNS = 3;
const TILE_WIDTH = `${100 / COLUMNS - 3}%` as const;

/** Año completo: un recuadro por mes con sus días de lectura. Tocar un mes abre su vista mensual. */
export function YearView({ year, onYearChange, today, days, onSelectMonth }: YearViewProps) {
  const { months, total } = summarizeYear(days, year);

  return (
    <View style={styles.container}>
      <PeriodHeader
        label={String(year)}
        onPrevious={() => onYearChange(year - 1)}
        onNext={() => onYearChange(year + 1)}
        canGoNext={year < today.year}
        previousLabel="Año anterior"
        nextLabel="Año siguiente"
      />
      <Text style={styles.totals}>
        {total.readingDays} {total.readingDays === 1 ? 'día de lectura' : 'días de lectura'}
        {total.minutes > 0 || total.pages > 0 ? ` · ${formatTotals(total)}` : ''}
      </Text>

      <View style={styles.grid}>
        {months.map((month) => {
          const future = year > today.year || (year === today.year && month.month > today.month);
          const isCurrent = year === today.year && month.month === today.month;
          const ratio = month.readingDays / month.daysInMonth;
          return (
            <Pressable
              key={month.month}
              accessibilityRole="button"
              accessibilityLabel={`${formatMonthLabel({ year, month: month.month })}: ${month.readingDays} ${
                month.readingDays === 1 ? 'día de lectura' : 'días de lectura'
              }`}
              accessibilityHint="Abre la vista del mes"
              accessibilityState={{ disabled: future }}
              disabled={future}
              onPress={() => onSelectMonth(year, month.month)}
              style={({ pressed }) => [
                styles.tile,
                isCurrent && styles.tileCurrent,
                future && styles.future,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.month} maxFontSizeMultiplier={maxFontScale}>
                {formatMonthShort(month.month)}
              </Text>
              <Text style={styles.days} maxFontSizeMultiplier={maxFontScale}>
                {month.readingDays}
              </Text>
              <View style={styles.track}>
                <View style={[styles.bar, { width: `${ratio * 100}%` }]} />
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  totals: { fontSize: fontSize.md, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.sm },
  tile: {
    width: TILE_WIDTH,
    minHeight: minTouchSize + spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  // El mes actual se distingue por el borde marcado (no solo por el color).
  tileCurrent: { borderColor: colors.primary, borderWidth: 2 },
  future: { opacity: opacity.disabled },
  pressed: { opacity: opacity.pressed },
  month: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textSecondary, textTransform: 'capitalize' },
  days: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.textPrimary },
  track: { alignSelf: 'stretch', height: BAR_HEIGHT, borderRadius: BAR_HEIGHT / 2, backgroundColor: colors.border, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: BAR_HEIGHT / 2, backgroundColor: colors.primary },
});
