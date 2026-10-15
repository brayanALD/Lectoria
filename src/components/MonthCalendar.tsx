import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { minTouchSize, opacity, spacing } from '../theme/spacing';
import { fontFamily, fontSize, maxFontScale } from '../theme/typography';
import {
  WEEKDAY_LABELS,
  addMonths,
  compareMonths,
  formatDateKeyLong,
  formatMonthLabel,
  getMonthGrid,
  monthOf,
  type YearMonth,
} from '../utils/calendar';
import { PeriodHeader } from './PeriodHeader';

interface MonthCalendarProps {
  /** Mes que se muestra. */
  month: YearMonth;
  onMonthChange: (month: YearMonth) => void;
  /** Clave «YYYY-MM-DD» de hoy: se resalta y es el límite natural para registrar lecturas. */
  todayKey: string;
  selectedKey?: string;
  /** Días con lectura: llevan un punto. */
  markedDays?: ReadonlySet<string>;
  /** Los días posteriores a esta clave no se pueden elegir. */
  maxKey?: string;
  onSelect: (dateKey: string) => void;
}

const DAY_SIZE = spacing.xl + spacing.sm;
const DOT_SIZE = spacing.xs;

/**
 * Calendario mensual (semanas de lunes a domingo). Se usa para elegir la fecha de una lectura y para ver los días
 * de lectura. Cada estado se distingue por forma, no solo por color: hoy lleva anillo, el día elegido va relleno y
 * un día de lectura lleva un punto.
 */
export function MonthCalendar({
  month,
  onMonthChange,
  todayKey,
  selectedKey,
  markedDays,
  maxKey,
  onSelect,
}: MonthCalendarProps) {
  const rows = getMonthGrid(month);
  const canGoForward = !maxKey || compareMonths(month, monthOf(maxKey)) < 0;

  return (
    <View style={styles.container}>
      <PeriodHeader
        label={formatMonthLabel(month)}
        onPrevious={() => onMonthChange(addMonths(month, -1))}
        onNext={() => onMonthChange(addMonths(month, 1))}
        canGoNext={canGoForward}
        previousLabel="Mes anterior"
        nextLabel="Mes siguiente"
      />

      {/* Las iniciales son decorativas: cada día se anuncia con su fecha completa. */}
      <View style={styles.row} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {WEEKDAY_LABELS.map((label) => (
          <Text key={label} style={styles.weekday}>
            {label}
          </Text>
        ))}
      </View>

      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((dateKey, columnIndex) => {
            if (!dateKey) return <View key={columnIndex} style={styles.cell} />;

            const selected = dateKey === selectedKey;
            const isToday = dateKey === todayKey;
            const marked = markedDays?.has(dateKey) ?? false;
            const disabled = Boolean(maxKey) && dateKey > (maxKey as string);
            const label = `${formatDateKeyLong(dateKey)}${isToday ? ', hoy' : ''}${marked ? ', día de lectura' : ''}`;

            return (
              <Pressable
                key={columnIndex}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityState={{ selected, disabled }}
                disabled={disabled}
                onPress={() => onSelect(dateKey)}
                style={[styles.cell, disabled && styles.disabled]}
              >
                <View style={[styles.day, selected && styles.daySelected, !selected && isToday && styles.dayToday]}>
                  <Text
                    style={[styles.dayText, { color: selected ? colors.onPrimary : colors.textPrimary }]}
                    maxFontSizeMultiplier={maxFontScale}
                  >
                    {Number(dateKey.slice(8))}
                  </Text>
                </View>
                <View style={[styles.dot, marked && { backgroundColor: colors.primary }]} />
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  row: { flexDirection: 'row' },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: fontSize.sm,
    fontFamily: fontFamily.semibold,
    color: colors.textSecondary,
  },
  cell: { flex: 1, minHeight: minTouchSize, alignItems: 'center', justifyContent: 'center', gap: DOT_SIZE },
  day: { width: DAY_SIZE, height: DAY_SIZE, borderRadius: DAY_SIZE / 2, alignItems: 'center', justifyContent: 'center' },
  daySelected: { backgroundColor: colors.primary },
  dayToday: { borderWidth: 1, borderColor: colors.outline },
  dayText: { fontSize: fontSize.md , fontFamily: fontFamily.regular},
  // El punto siempre ocupa su sitio (transparente si no hay lectura) para que las filas no cambien de altura.
  dot: { width: DOT_SIZE, height: DOT_SIZE, borderRadius: DOT_SIZE / 2 },
  disabled: { opacity: opacity.disabled },
});
