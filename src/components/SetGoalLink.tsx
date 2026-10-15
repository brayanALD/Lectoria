import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text } from 'react-native';

import { makeStyles, useTheme } from '../context/ThemeContext';
import { iconSize, minTouchSize, opacity, spacing } from '../theme/spacing';
import { fontFamily, fontSize } from '../theme/typography';

/** «Fijar meta diaria»: lo que se ofrece donde iría el progreso de la meta cuando todavía no hay ninguna. */
export function SetGoalLink({ onPress }: { onPress: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Fijar meta diaria"
      onPress={onPress}
      style={({ pressed }) => [styles.link, pressed && styles.pressed]}
    >
      <Ionicons name="flag-outline" size={iconSize.md} color={colors.primary} accessible={false} />
      <Text style={styles.label}>Fijar meta diaria</Text>
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
