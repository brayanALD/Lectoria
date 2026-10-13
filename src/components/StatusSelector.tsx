import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ReadingStatus } from '../types/book';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { fontSize, fontWeight } from '../theme/typography';
import { READING_STATUSES, READING_STATUS_LABELS } from '../utils/book';

interface StatusSelectorProps {
  label?: string;
  value: ReadingStatus;
  onChange: (status: ReadingStatus) => void;
  error?: string;
}

const CHIP_HEIGHT = 44;

// Selector de estado de lectura de elección única, con opciones visibles a la vez (son solo cinco).
export function StatusSelector({ label = 'Estado de lectura', value, onChange, error }: StatusSelectorProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
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
              style={[styles.chip, selected ? styles.chipSelected : styles.chipIdle]}
            >
              <Text style={[styles.chipText, { color: selected ? colors.onPrimary : colors.textPrimary }]}>
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
    minHeight: CHIP_HEIGHT,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipIdle: { backgroundColor: colors.surface, borderColor: colors.border },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  error: { fontSize: fontSize.sm, color: colors.error },
});
