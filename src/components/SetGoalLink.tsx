import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text } from 'react-native';

import { makeStyles, useTheme } from '../context/ThemeContext';
import { iconSize, minTouchSize, opacity, spacing } from '../theme/spacing';
import { fontFamily, fontSize } from '../theme/typography';

interface SetGoalLinkProps {
  onPress: () => void;
  /** Lo que dice el enlace (por defecto, la meta diaria). */
  label?: string;
}

/** «Fijar meta diaria»: lo que se ofrece donde iría el progreso de la meta cuando todavía no hay ninguna. */
export function SetGoalLink({ onPress, label = 'Fijar meta diaria' }: SetGoalLinkProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.link, pressed && styles.pressed]}
    >
      <Ionicons name="flag-outline" size={iconSize.md} color={colors.primary} accessible={false} />
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: minTouchSize,
  },
  label: { fontSize: fontSize.md, fontFamily: fontFamily.semibold, color: colors.primary },
  pressed: { opacity: opacity.pressed },
}));
