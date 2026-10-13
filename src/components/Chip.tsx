import { Pressable, StyleSheet, Text } from 'react-native';

import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { fontSize, fontWeight } from '../theme/typography';

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
}

const CHIP_HEIGHT = 40;

// Etiqueta pulsable de selección (filtros). Con `hitSlop` el área táctil llega a ≥ 44 pt sin hacerla más alta.
export function Chip({ label, selected, onPress, accessibilityLabel }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      hitSlop={{ top: 2, bottom: 2 }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected ? styles.selected : styles.idle, pressed && styles.pressed]}
    >
      <Text style={[styles.label, { color: selected ? colors.onPrimary : colors.textPrimary }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: CHIP_HEIGHT,
    maxWidth: 240,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  idle: { backgroundColor: colors.surface, borderColor: colors.border },
  selected: { backgroundColor: colors.primary, borderColor: colors.primary },
  pressed: { opacity: 0.8 },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
});
