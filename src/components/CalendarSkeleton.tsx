import { StyleSheet, View } from 'react-native';

import { minTouchSize, radius, spacing } from '../theme/spacing';
import { fontSize } from '../theme/typography';
import { Skeleton, SkeletonPulse } from './Skeleton';

const WEEKS = 5;
const DAYS = 7;

/** Silueta de la pestaña Calendario: selector de vista, encabezado del mes y la cuadrícula de días. */
export function CalendarSkeleton() {
  return (
    <SkeletonPulse label="Cargando calendario">
      <View style={styles.container}>
        <View style={styles.switch}>
          {[0, 1, 2].map((index) => (
            <View key={index} style={styles.switchItem}>
              <Skeleton height={minTouchSize} style={styles.pill} />
            </View>
          ))}
        </View>
        <Skeleton width="55%" height={fontSize.lg} style={styles.center} />
        {Array.from({ length: WEEKS }, (_, week) => (
          <View key={week} style={styles.week}>
            {Array.from({ length: DAYS }, (_, day) => (
              <View key={day} style={styles.day}>
                <Skeleton width={spacing.xl + spacing.sm} height={spacing.xl + spacing.sm} style={styles.circle} />
              </View>
            ))}
          </View>
        ))}
      </View>
    </SkeletonPulse>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, gap: spacing.md },
  switch: { flexDirection: 'row', gap: spacing.sm },
  switchItem: { flex: 1 },
  pill: { borderRadius: radius.pill },
  center: { alignSelf: 'center' },
  week: { flexDirection: 'row' },
  day: { flex: 1, minHeight: minTouchSize, alignItems: 'center', justifyContent: 'center' },
  circle: { borderRadius: spacing.xl },
});
