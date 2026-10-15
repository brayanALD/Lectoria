import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { makeStyles, useTheme } from '../../context/ThemeContext';
import { iconSize, minTouchSize, opacity, radius, spacing } from '../../theme/spacing';
import { fontFamily, fontSize } from '../../theme/typography';
import type { ThemeMode } from '../../utils/themeMode';
import { SettingsSection } from './SettingsSection';

const OPTIONS: { mode: ThemeMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { mode: 'light', label: 'Claro', icon: 'sunny-outline' },
  { mode: 'dark', label: 'Oscuro', icon: 'moon-outline' },
];

/** Tema de la app: claro u oscuro. El cambio es inmediato en toda la app y se recuerda para la próxima vez. */
export function AppearanceSection() {
  const styles = useStyles();
  const { colors, mode, setMode } = useTheme();

  return (
    <SettingsSection title="Apariencia">
      <View accessibilityRole="radiogroup" accessibilityLabel="Tema" style={styles.group}>
        {OPTIONS.map((option) => {
          const selected = option.mode === mode;
          return (
            <Pressable
              key={option.mode}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityState={{ selected, checked: selected }}
              onPress={() => setMode(option.mode)}
              style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.pressed]}
            >
              <Ionicons
                name={option.icon}
                size={iconSize.md}
                color={selected ? colors.onPrimary : colors.primary}
                accessible={false}
              />
              <Text style={[styles.label, { color: selected ? colors.onPrimary : colors.textPrimary }]}>{option.label}</Text>
              {selected ? <Ionicons name="checkmark" size={iconSize.md} color={colors.onPrimary} accessible={false} /> : null}
            </Pressable>
          );
        })}
      </View>
    </SettingsSection>
  );
}

const useStyles = makeStyles((colors) =>
  StyleSheet.create({
    group: { gap: spacing.sm },
    // Controles: borde `outline`; la opción elegida se distingue por el relleno y la marca, no solo por el color.
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      minHeight: minTouchSize,
      paddingHorizontal: spacing.md,
      borderWidth: 1,
      borderColor: colors.outline,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
    },
    optionSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
    label: { flex: 1, fontSize: fontSize.md, fontFamily: fontFamily.semibold },
    pressed: { opacity: opacity.pressed },
  }),
);
