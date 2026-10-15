import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../../../theme/colors';
import { radius, spacing } from '../../../theme/spacing';
import { fontSize, fontWeight } from '../../../theme/typography';

interface StatTileProps {
  label: string;
  value: string;
}

/** Una cifra de las estadísticas con su nombre («12 h 05 min» / «Tiempo»). Se lee como una sola frase. */
export function StatTile({ label, value }: StatTileProps) {
  return (
    <View style={styles.tile} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceTint,
  },
  value: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.textPrimary },
  label: { fontSize: fontSize.sm, color: colors.textSecondary },
});
