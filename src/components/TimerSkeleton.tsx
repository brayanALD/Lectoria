import { StyleSheet, View } from 'react-native';

import { minTouchSize, radius, spacing } from '../theme/spacing';
import { fontSize } from '../theme/typography';
import { Skeleton, SkeletonPulse } from './Skeleton';

/** Silueta del cronómetro: el libro, el tiempo y el botón principal. */
export function TimerSkeleton() {
  return (
    <SkeletonPulse label="Cargando cronómetro">
      <View style={styles.container}>
        <View style={styles.field}>
          <Skeleton width="20%" height={fontSize.sm} />
          <Skeleton height={minTouchSize} style={styles.rounded} />
        </View>
        <View style={styles.clock}>
          <Skeleton width="60%" height={fontSize.xl * 2} />
        </View>
        <Skeleton height={minTouchSize} style={styles.rounded} />
      </View>
    </SkeletonPulse>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, gap: spacing.xl },
  field: { gap: spacing.xs },
  clock: { alignItems: 'center' },
  rounded: { borderRadius: radius.md },
});
