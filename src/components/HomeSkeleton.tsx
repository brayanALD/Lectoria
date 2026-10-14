import { StyleSheet, View } from 'react-native';

import { minTouchSize, radius, spacing } from '../theme/spacing';
import { fontSize } from '../theme/typography';
import { SessionRowsSkeleton } from './BookSkeletons';
import { Skeleton, SkeletonPulse } from './Skeleton';

/** Silueta de Inicio: la racha, la meta diaria, los dos botones y la actividad reciente. */
export function HomeSkeleton() {
  return (
    <SkeletonPulse label="Cargando inicio">
      <View style={styles.container}>
        <View style={styles.streak}>
          <Skeleton width={spacing.xl * 2} height={fontSize.xl * 2} />
          <Skeleton width={spacing.xl * 4} height={fontSize.md} />
        </View>
        <View style={styles.goal}>
          <Skeleton width="45%" height={fontSize.md} />
          <Skeleton height={spacing.sm} />
          <Skeleton width="30%" height={fontSize.sm} />
        </View>
        <View style={styles.actions}>
          <Skeleton height={minTouchSize} style={styles.rounded} />
          <Skeleton height={minTouchSize} style={styles.rounded} />
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
  streak: { alignItems: 'center', gap: spacing.sm },
  goal: { gap: spacing.sm },
  actions: { gap: spacing.md },
  activity: { gap: spacing.sm },
  rounded: { borderRadius: radius.md },
});
