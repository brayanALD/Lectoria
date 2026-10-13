import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ReadingStatus } from '../types/book';
import { colors } from '../theme/colors';
import { minTouchSize, opacity, radius, spacing } from '../theme/spacing';
import { fontSize, fontWeight, maxFontScale } from '../theme/typography';
import { READING_STATUSES, READING_STATUS_LABELS } from '../utils/book';

interface StatusSelectorProps {
  /** Nombre accesible del grupo; también se muestra salvo que se indique `showLabel={false}`. */
  label?: string;
  /** false cuando el contexto ya deja claro de qué es el selector (p. ej. en el detalle del libro). */
  showLabel?: boolean;
  value: ReadingStatus;
  onChange: (status: ReadingStatus) => void;
  error?: string;
}

// Selector de estado de lectura de elección única, con opciones visibles a la vez (son solo cinco).
export function StatusSelector({
  label = 'Estado de lectura',
  showLabel = true,
  value,
  onChange,
  error,
}: StatusSelectorProps) {
  return (
    <View style={styles.container}>
      {showLabel ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.options} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {READING_STATUSES.map((status) => {
          const selected = status === value;
          return (
            <Pressable
              key={status}
              accessibilityRole="radio"
              accessibilityLabel={READING_STATUS_LABELS[status]}
              accessibilityState={{ selected, checked: selected }}
              onPress={() => onChange(status)}
              style={({ pressed }) => [styles.chip, selected ? styles.chipSelected : styles.chipIdle, pressed && styles.pressed]}
            >
              <Text
                style={[styles.chipText, { color: selected ? colors.onPrimary : colors.textPrimary }]}
                maxFontSizeMultiplier={maxFontScale}
              >
                {READING_STATUS_LABELS[status]}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minHeight: minTouchSize,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipIdle: { backgroundColor: colors.surface, borderColor: colors.outline },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  pressed: { opacity: opacity.pressed },
  chipText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  error: { fontSize: fontSize.sm, color: colors.error },
});
