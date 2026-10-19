import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { makeStyles, useTheme } from '../context/ThemeContext';
import { iconSize, minTouchSize, opacity, radius, spacing } from '../theme/spacing';
import { fontFamily, fontSize } from '../theme/typography';

interface NavRowProps {
  title: string;
  /** Una línea con el detalle (cuántos libros, qué filtros…). */
  subtitle?: string;
  /** Icono a la izquierda, en un círculo (p. ej. para distinguir una colección de una estantería). */
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  accessibilityHint?: string;
}

/** Una fila que abre otra pantalla: título, detalle opcional y una flecha. Se usa en las listas de «Mi biblioteca». */
export function NavRow({ title, subtitle, icon, onPress, accessibilityHint }: NavRowProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {icon ? (
        <View style={styles.badge} accessible={false} importantForAccessibility="no-hide-descendants">
          <Ionicons name={icon} size={iconSize.sm} color={colors.primary} />
        </View>
      ) : null}
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={iconSize.md} color={colors.textSecondary} accessible={false} />
    </Pressable>
  );
}

/** Alto de una fila con detalle: lo usa también su silueta de carga. */
export const NAV_ROW_HEIGHT = minTouchSize + spacing.md;
/** Diámetro del círculo del icono. */
export const NAV_ROW_BADGE = minTouchSize - spacing.sm;

const useStyles = makeStyles((colors) => StyleSheet.create({
  row: {
    minHeight: NAV_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceTint,
  },
  pressed: { opacity: opacity.pressed },
  badge: {
    width: NAV_ROW_BADGE,
    height: NAV_ROW_BADGE,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
  },
  text: { flex: 1, gap: spacing.xs / 2 },
  title: { fontSize: fontSize.md, fontFamily: fontFamily.semibold, color: colors.textPrimary },
  subtitle: { fontSize: fontSize.sm, fontFamily: fontFamily.regular, color: colors.textSecondary },
}));
