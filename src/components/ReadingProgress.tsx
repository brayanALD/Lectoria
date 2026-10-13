import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { fontSize } from '../theme/typography';

interface ReadingProgressProps {
  /** 0–100. */
  percent: number;
  /** Muestra el porcentaje escrito junto a la barra. */
  showLabel?: boolean;
}

const TRACK_HEIGHT = 6;

export function ReadingProgress({ percent, showLabel = true }: ReadingProgressProps) {
  const value = Math.min(100, Math.max(0, percent));

  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Progreso de lectura"
      accessibilityValue={{ min: 0, max: 100, now: value, text: `${value} %` }}
    >
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${value}%` }]} />
      </View>
      {showLabel ? <Text style={styles.label}>{value} %</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  track: {
    flex: 1,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: TRACK_HEIGHT / 2, backgroundColor: colors.primary },
  label: { fontSize: fontSize.sm, color: colors.textSecondary, minWidth: 36, textAlign: 'right' },
});
