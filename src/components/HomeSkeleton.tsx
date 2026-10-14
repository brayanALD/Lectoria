import { StyleSheet, View } from 'react-native';

import { minTouchSize, radius, spacing } from '../theme/spacing';
import { fontSize } from '../theme/typography';
import { Skeleton, SkeletonPulse } from './Skeleton';

/** Silueta de Inicio: el número de la racha, su leyenda y el botón de registrar lectura. */
export function HomeSkeleton() {
  return (
    <SkeletonPulse label="Cargando inicio">
      <View style={styles.container}>
        <View style={styles.streak}>
          <Skeleton width={spacing.xl * 2} height={fontSize.xl * 2} />
          <Skeleton width={spacing.xl * 4} height={fontSize.md} />
        </View>
        <Skeleton height={minTouchSize} style={styles.rounded} />
      </View>
    </SkeletonPulse>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, justifyContent: 'center', gap: spacing.xl },
  streak: { alignItems: 'center', gap: spacing.sm },
  rounded: { borderRadius: radius.md },
});
