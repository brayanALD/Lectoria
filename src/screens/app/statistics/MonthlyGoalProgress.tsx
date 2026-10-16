import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ReadingProgress } from '../../../components/ReadingProgress';
import { makeStyles, useTheme } from '../../../context/ThemeContext';
import { iconSize, opacity, radius, spacing } from '../../../theme/spacing';
import { fontFamily, fontSize } from '../../../theme/typography';
import {
  describeMonthlyGoalProgress,
  describeMonthlyGoalSummary,
  type MonthlyGoalProgressInfo,
} from '../../../utils/monthlyGoal';

interface MonthlyGoalProgressProps {
  progress: MonthlyGoalProgressInfo;
  /** El mes ya pasó: el texto habla en pasado («Faltaron 2 libros»). */
  past?: boolean;
  /** Abre el cambio de objetivo. */
  onPress: () => void;
}

/**
 * Cuántos libros se han terminado del objetivo del mes («2 de 5 libros»), una barra y lo que falta (o «Objetivo
 * cumplido»). Mismo aspecto que `GoalProgress`, la meta diaria. El estado se comunica con texto e icono, no solo con la barra.
 */
export function MonthlyGoalProgress({ progress, past = false, onPress }: MonthlyGoalProgressProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const summary = describeMonthlyGoalSummary(progress);
  const status = describeMonthlyGoalProgress(progress, past);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Objetivo mensual: ${summary}. ${status}`}
      accessibilityHint="Toca para cambiar el objetivo"
      onPress={onPress}
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
    >
      <View style={styles.row}>
        <Text style={styles.summary}>{summary}</Text>
        <Ionicons name="create-outline" size={iconSize.md} color={colors.primary} accessible={false} />
      </View>
      <ReadingProgress
        percent={progress.percent}
        showLabel={false}
        accessibilityLabel="Objetivo mensual"
        valueText={`${summary}. ${status}`}
      />
      <View style={styles.statusRow}>
        {progress.met ? <Ionicons name="checkmark-circle" size={iconSize.sm} color={colors.success} accessible={false} /> : null}
        <Text style={[styles.status, progress.met && styles.statusMet]}>{status}</Text>
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((colors) =>
  StyleSheet.create({
    container: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceTint },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    summary: { fontSize: fontSize.md, fontFamily: fontFamily.regular, color: colors.textPrimary },
    status: { fontSize: fontSize.sm, fontFamily: fontFamily.regular, color: colors.textSecondary },
    statusMet: { fontFamily: fontFamily.semibold, color: colors.success },
    pressed: { opacity: opacity.pressed },
  }),
);
