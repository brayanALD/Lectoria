import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, googleButton } from '../theme/colors';
import { minTouchSize, radius, spacing } from '../theme/spacing';
import { fontSize, fontWeight } from '../theme/typography';

interface ButtonProps {
  title: string;
  onPress: () => void;
  /** `google` sigue las directrices de marca de Google (solo para «Continuar con Google»). */
  variant?: 'primary' | 'secondary' | 'google';
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
  const contentColor = isPrimary ? colors.onPrimary : isGoogle ? googleButton.text : colors.primary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        isPrimary ? styles.primary : isGoogle ? styles.google : styles.secondary,
        pressed && isPrimary && { backgroundColor: colors.pressed },
        pressed && isGoogle && { backgroundColor: googleButton.backgroundPressed },
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
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: minTouchSize,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.primary },
  google: { backgroundColor: googleButton.background, borderWidth: 1, borderColor: googleButton.border },
  disabled: { opacity: 0.5 },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + spacing.xs },
  label: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
});
