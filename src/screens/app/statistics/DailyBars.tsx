import { StyleSheet, Text, View } from 'react-native';

import { makeStyles } from '../../../context/ThemeContext';
import { minTouchSize, spacing } from '../../../theme/spacing';
import { fontFamily, fontSize } from '../../../theme/typography';
import type { DayPoint } from '../../../utils/statistics';

interface DailyBarsProps {
  /** Un punto por día del mes, en orden. */
  points: readonly DayPoint[];
  /** La meta diaria en la misma unidad que `point.value`; con ella se dibuja la línea y se distinguen los días cumplidos. */
  goalValue?: number;
  /** Lo que ve el gráfico, dicho en una frase para el lector de pantalla. */
  accessibilityLabel: string;
}

const PLOT_HEIGHT = minTouchSize * 2;
const MIN_BAR_HEIGHT = 2;
const BAR_GAP = 2;
const GOAL_LINE_HEIGHT = 1;
const SWATCH_SIZE = spacing.sm + spacing.xs;

/**
 * Barras de lo leído cada día del mes. Con meta, un día cumplido es una barra rellena y uno sin cumplir una barra
 * vacía con borde (la diferencia es de forma, no solo de color), y una línea marca la meta. Es una imagen para el
 * lector de pantalla: las barras no se tocan una a una (serían de menos de 48 pt); el detalle de cada día está en la
 * vista «Día» y en el Calendario.
 */
export function DailyBars({ points, goalValue, accessibilityLabel }: DailyBarsProps) {
  const styles = useStyles();
  const scaleMax = Math.max(1, goalValue ?? 0, ...points.map((point) => point.value));
  const hasGoal = goalValue !== undefined;
  const firstDay = Number(points[0]?.dateKey.slice(8));
  const lastDay = Number(points[points.length - 1]?.dateKey.slice(8));

  return (
    <View style={styles.container}>
      <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel} style={styles.chart}>
        <View style={styles.plot} importantForAccessibility="no-hide-descendants">
          {hasGoal ? <View style={[styles.goalLine, { bottom: (goalValue / scaleMax) * PLOT_HEIGHT }]} /> : null}
          {points.map((point) => {
            const height = point.value > 0 ? Math.max(MIN_BAR_HEIGHT, (point.value / scaleMax) * PLOT_HEIGHT) : 0;
            const unmet = hasGoal && point.goalMet === false;
            return (
              <View key={point.dateKey} style={styles.column}>
                <View style={[styles.bar, unmet ? styles.barUnmet : styles.barFilled, { height }]} />
              </View>
            );
          })}
        </View>
        <View style={styles.axis} importantForAccessibility="no-hide-descendants">
          <Text style={styles.axisLabel}>{firstDay}</Text>
          <Text style={styles.axisLabel}>{lastDay}</Text>
        </View>
      </View>

      {hasGoal ? (
        <View style={styles.legend}>
          <LegendItem label="Meta cumplida" swatch={[styles.swatch, styles.barFilled]} />
          <LegendItem label="Sin cumplir" swatch={[styles.swatch, styles.barUnmet]} />
          <LegendItem label="Meta" swatch={styles.swatchLine} />
        </View>
      ) : null}
    </View>
  );
}

function LegendItem({ label, swatch }: { label: string; swatch: object }) {
  const styles = useStyles();
  return (
    <View style={styles.legendItem}>
      <View style={swatch} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  container: { gap: spacing.sm },
  chart: { gap: spacing.xs },
  plot: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: BAR_GAP,
    height: PLOT_HEIGHT,
    borderBottomWidth: 1,
    borderBottomColor: colors.outline,
  },
  column: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderTopLeftRadius: BAR_GAP, borderTopRightRadius: BAR_GAP },
  barFilled: { backgroundColor: colors.primary },
  // Vacía y con borde: se distingue de la rellena por la forma, además del color.
  barUnmet: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.primary },
  goalLine: { position: 'absolute', left: 0, right: 0, height: GOAL_LINE_HEIGHT, backgroundColor: colors.textSecondary },
  axis: { flexDirection: 'row', justifyContent: 'space-between' },
  axisLabel: { fontSize: fontSize.xs, fontFamily: fontFamily.regular, color: colors.textSecondary },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  swatch: { width: SWATCH_SIZE, height: SWATCH_SIZE, borderRadius: GOAL_LINE_HEIGHT * 2 },
  swatchLine: { width: SWATCH_SIZE, height: GOAL_LINE_HEIGHT, backgroundColor: colors.textSecondary },
  legendLabel: { fontSize: fontSize.xs, fontFamily: fontFamily.regular, color: colors.textSecondary },
}));
