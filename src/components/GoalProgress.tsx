import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { iconSize, opacity, radius, spacing } from '../theme/spacing';
import { fontFamily, fontSize } from '../theme/typography';
import { describeGoalProgress, describeGoalSummary, type GoalProgressInfo } from '../utils/dailyGoal';
import { ReadingProgress } from './ReadingProgress';

interface GoalProgressProps {
  progress: GoalProgressInfo;
  /** El día ya pasó: el texto habla en pasado («Faltaron 10 min»). */
  past?: boolean;
  /** Si se indica, el bloque es un botón (en Inicio abre el cambio de meta). */
  onPress?: () => void;
}

/**
 * Cuánto de la meta diaria se ha leído («12 min de 30 min» o «8 págs de 20 págs»), una barra y lo que falta (o «Meta cumplida»).
 * El estado se comunica con texto e icono, no solo con la barra. Lo usan Inicio (hoy) y el Calendario (cualquier día).
 */
export function GoalProgress({ progress, past = false, onPress }: GoalProgressProps) {
  const summary = describeGoalSummary(progress);
  const status = describeGoalProgress(progress, past);

  const body = (
    <>
      <View style={styles.row}>
        <Text style={styles.summary}>{summary}</Text>
        {onPress ? <Ionicons name="create-outline" size={iconSize.md} color={colors.primary} accessible={false} /> : null}
      </View>
      <ReadingProgress
        percent={progress.percent}
        showLabel={false}
        accessibilityLabel="Meta diaria"
        valueText={`${summary}. ${status}`}
      />
      <View style={styles.statusRow}>
        {progress.met ? <Ionicons name="checkmark-circle" size={iconSize.sm} color={colors.success} accessible={false} /> : null}
        <Text style={[styles.status, progress.met && styles.statusMet]}>{status}</Text>
      </View>
    </>
  );

  if (!onPress) return <View style={styles.container}>{body}</View>;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Meta diaria: ${summary}. ${status}`}
      accessibilityHint="Toca para cambiar la meta"
      onPress={onPress}
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceTint },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  summary: { fontSize: fontSize.md, fontFamily: fontFamily.regular, color: colors.textPrimary },
  status: { fontSize: fontSize.sm, fontFamily: fontFamily.regular, color: colors.textSecondary },
  statusMet: { fontFamily: fontFamily.semibold, color: colors.success },
  pressed: { opacity: opacity.pressed },
});
