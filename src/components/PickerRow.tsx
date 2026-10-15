import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { makeStyles, useTheme } from '../context/ThemeContext';
import { iconSize, minTouchSize, opacity, radius, spacing } from '../theme/spacing';
import { fontFamily, fontSize } from '../theme/typography';

interface PickerRowProps {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Sin `onPress` la fila solo informa (p. ej. el libro fijo al venir desde su detalle). */
  onPress?: () => void;
  error?: string;
}

// Campo que se elige en una hoja en lugar de escribirse; se ve igual que un `TextField`.
export function PickerRow({ label, value, icon, onPress, error }: PickerRowProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const body = (
    <View style={[styles.field, error ? styles.fieldError : null]}>
      <Text style={styles.fieldValue} numberOfLines={1}>
        {value}
      </Text>
      {onPress ? <Ionicons name={icon} size={iconSize.md} color={colors.primary} /> : null}
    </View>
  );

  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      {onPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${value}`}
          accessibilityHint="Toca para cambiar"
          onPress={onPress}
          style={({ pressed }) => pressed && styles.pressed}
        >
          {body}
        </Pressable>
      ) : (
        <View accessible accessibilityLabel={`${label}: ${value}`}>
          {body}
        </View>
      )}
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  group: { gap: spacing.xs },
  label: { fontSize: fontSize.sm, fontFamily: fontFamily.semibold, color: colors.textPrimary },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    minHeight: minTouchSize,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  fieldError: { borderColor: colors.error },
  fieldValue: { flex: 1, fontSize: fontSize.md, fontFamily: fontFamily.regular, color: colors.textPrimary },
  pressed: { opacity: opacity.pressed },
  error: { fontSize: fontSize.sm, fontFamily: fontFamily.regular, color: colors.error },
}));
