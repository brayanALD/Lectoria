import { Ionicons } from '@expo/vector-icons';
import { useState, type Ref } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { colors } from '../theme/colors';
import { minTouchSize, radius, spacing } from '../theme/spacing';
import { fontSize, fontWeight } from '../theme/typography';

interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string;
  /** Texto de ayuda bajo el campo; se oculta mientras haya un error. */
  hint?: string;
  /** Permite enfocar el campo desde fuera (p. ej. al pulsar «siguiente» en el teclado). */
  ref?: Ref<TextInput>;
}

export function TextField({ label, error, hint, style, secureTextEntry, ref, ...inputProps }: TextFieldProps) {
  // Los campos de contraseña (secureTextEntry) incluyen un botón para mostrar u ocultar el texto.
  const [passwordVisible, setPasswordVisible] = useState(false);
  const isPassword = Boolean(secureTextEntry);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.field, error ? styles.fieldError : null]}>
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          placeholderTextColor={colors.textSecondary}
          secureTextEntry={isPassword && !passwordVisible}
          style={[styles.input, style]}
          {...inputProps}
        />
        {isPassword ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={passwordVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            hitSlop={spacing.sm}
            onPress={() => setPasswordVisible((visible) => !visible)}
            style={styles.toggle}
          >
            <Ionicons
              name={passwordVisible ? 'eye-outline' : 'eye-off-outline'}
              size={22}
              color={colors.textSecondary}
            />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: minTouchSize,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  fieldError: { borderColor: colors.error },
  input: {
    flex: 1,
    alignSelf: 'stretch',
    paddingHorizontal: spacing.md,
    fontSize: fontSize.md,
    color: colors.textPrimary,
  },
  toggle: {
    width: minTouchSize,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: { fontSize: fontSize.sm, color: colors.error },
  hint: { fontSize: fontSize.sm, color: colors.textSecondary },
});
