import { Ionicons } from '@expo/vector-icons';
import { useState, type Ref } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { makeStyles, useTheme } from '../context/ThemeContext';
import { iconSize, minTouchSize, opacity, radius, spacing } from '../theme/spacing';
import { fontFamily, fontSize } from '../theme/typography';

interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string;
  /** Botón de icono dentro del campo, a la derecha (p. ej. la cámara para escanear). No se combina con contraseña. */
  action?: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void };
  /** Permite enfocar el campo desde fuera (p. ej. al pulsar «siguiente» en el teclado). */
  ref?: Ref<TextInput>;
}

export function TextField({ label, error, action, style, secureTextEntry, ref, ...inputProps }: TextFieldProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  // Los campos de contraseña (secureTextEntry) incluyen un botón para mostrar u ocultar el texto.
  const [passwordVisible, setPasswordVisible] = useState(false);
  const isPassword = Boolean(secureTextEntry);
  // Con `editable={false}` el campo solo muestra su valor: se ve atenuado y se anuncia como deshabilitado.
  const disabled = inputProps.editable === false;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.field, error ? styles.fieldError : null, disabled && styles.fieldDisabled]}>
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          accessibilityState={disabled ? { disabled: true } : undefined}
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
              size={iconSize.md}
              color={colors.textSecondary}
            />
          </Pressable>
        ) : action ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={action.label}
            onPress={action.onPress}
            style={styles.toggle}
          >
            <Ionicons name={action.icon} size={iconSize.md} color={colors.primary} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  container: { gap: spacing.xs },
  label: { fontSize: fontSize.sm, fontFamily: fontFamily.semibold, color: colors.textPrimary },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: minTouchSize,
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  fieldError: { borderColor: colors.error },
  fieldDisabled: { opacity: opacity.disabled },
  input: {
    flex: 1,
    alignSelf: 'stretch',
    paddingHorizontal: spacing.md,
    fontSize: fontSize.md, fontFamily: fontFamily.regular,
    color: colors.textPrimary,
  },
  toggle: {
    width: minTouchSize,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: { fontSize: fontSize.sm, fontFamily: fontFamily.regular, color: colors.error },
}));
