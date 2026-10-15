import { StyleSheet, View } from 'react-native';

import { colors } from '../theme/colors';
import { minTouchSize, radius, spacing } from '../theme/spacing';
import { fontSize } from '../theme/typography';
import { SessionRowsSkeleton } from './BookSkeletons';
import { Skeleton, SkeletonPulse } from './Skeleton';

// Alto de las cards «Registrar lectura» y «Cronómetro»: igual que `ReadingActions` (`minTouchSize * 2.5`).
const ACTION_CARD_HEIGHT = minTouchSize * 2.5;

/** Silueta de Inicio: la racha, la meta diaria, las dos cards de lectura y la actividad reciente. */
export function HomeSkeleton() {
  return (
    <SkeletonPulse label="Cargando inicio">
      <View style={styles.container}>
        <View style={styles.streak}>
          <View style={styles.streakText}>
            <Skeleton width={spacing.xl * 2} height={fontSize.xl * 2} />
            <Skeleton width={spacing.xl * 4} height={fontSize.md} />
          </View>
          <Skeleton width={minTouchSize + spacing.sm} height={minTouchSize + spacing.sm} style={styles.circle} />
        </View>
        <View style={styles.goal}>
          <Skeleton width="45%" height={fontSize.md} />
          <Skeleton height={spacing.sm} />
          <Skeleton width="30%" height={fontSize.sm} />
        </View>
        <View style={styles.cards}>
          <View style={styles.card}>
            <Skeleton height={ACTION_CARD_HEIGHT} style={styles.rounded} />
          </View>
          <View style={styles.card}>
            <Skeleton height={ACTION_CARD_HEIGHT} style={styles.rounded} />
          </View>
        </View>
        <View style={styles.activity}>
          <Skeleton width="40%" height={fontSize.lg} />
          <SessionRowsSkeleton />
        </View>
      </View>
    </SkeletonPulse>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, gap: spacing.xl },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceTint,
  },
  streakText: { flex: 1, gap: spacing.xs },
  circle: { borderRadius: radius.pill },
  goal: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceTint },
  cards: { flexDirection: 'row', gap: spacing.md },
  card: { flex: 1 },
  activity: { gap: spacing.sm },
  rounded: { borderRadius: radius.lg },
});
