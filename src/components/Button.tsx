import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { minTouchSize, opacity, radius, spacing } from '../theme/spacing';
import { fontFamily, fontSize } from '../theme/typography';
import { PressableScale } from './PressableScale';

interface ButtonProps {
  title: string;
  onPress: () => void;
  /** `google` es el fondo claro con borde de control que lleva el logo de Google (solo «Continuar con Google»). */
  /** `danger` es para acciones destructivas (p. ej. eliminar). */
  variant?: 'primary' | 'secondary' | 'google' | 'danger';
  /** Elemento decorativo a la izquierda del texto (p. ej. un logo). */
  icon?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading = false,
  disabled = false,
}: ButtonProps) {
  const inactive = disabled || loading;
  const isPrimary = variant === 'primary';
  const isGoogle = variant === 'google';
  const isDanger = variant === 'danger';
  const contentColor = isPrimary
    ? colors.onPrimary
    : isGoogle
      ? colors.onBrandSurface
      : isDanger
        ? colors.error
        : colors.primary;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        isPrimary ? styles.primary : isGoogle ? styles.google : isDanger ? styles.danger : styles.secondary,
        pressed && (isPrimary ? { backgroundColor: colors.pressed } : styles.pressed),
        disabled && !loading && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={contentColor} />
      ) : (
        <View style={styles.content}>
          {icon}
          <Text style={[styles.label, { color: contentColor }]}>{title}</Text>
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: minTouchSize,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.primary },
  danger: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.error },
  google: { backgroundColor: colors.brandSurface, borderWidth: 1, borderColor: colors.brandOutline },
  pressed: { opacity: opacity.pressed },
  disabled: { opacity: opacity.disabled },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { fontSize: fontSize.md, fontFamily: fontFamily.semibold },
});
