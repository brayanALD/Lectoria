import { Pressable, StyleSheet, Text } from 'react-native';

import { makeStyles, useTheme } from '../context/ThemeContext';
import { minTouchSize, opacity, radius, spacing } from '../theme/spacing';
import { fontFamily, fontSize, maxFontScale } from '../theme/typography';

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
}

// Etiqueta pulsable de selección (filtros). La seleccionada se distingue por el fondo relleno, no solo por el color.
export function Chip({ label, selected, onPress, accessibilityLabel }: ChipProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected ? styles.selected : styles.idle, pressed && styles.pressed]}
    >
      <Text
        style={[styles.label, { color: selected ? colors.onPrimary : colors.textPrimary }]}
        numberOfLines={1}
        maxFontSizeMultiplier={maxFontScale}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  chip: {
    minHeight: minTouchSize,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  idle: { backgroundColor: colors.surface, borderColor: colors.outline },
  selected: { backgroundColor: colors.primary, borderColor: colors.primary },
  pressed: { opacity: opacity.pressed },
  label: { fontSize: fontSize.sm, fontFamily: fontFamily.semibold },
}));
