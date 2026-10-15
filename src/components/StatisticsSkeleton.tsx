import { StyleSheet, View } from 'react-native';

import { makeStyles } from '../context/ThemeContext';
import { minTouchSize, radius, spacing } from '../theme/spacing';
import { fontSize } from '../theme/typography';
import { Skeleton, SkeletonPulse } from './Skeleton';

// Medidas que coinciden con las de la pantalla real (`StatTile` y `DailyBars`), para que al cargar nada «salte».
const TILE_HEIGHT = spacing.md * 2 + fontSize.lg + fontSize.sm + spacing.xs * 2;
const CHART_HEIGHT = minTouchSize * 2;

/** Silueta de Estadísticas: el selector de vista, el encabezado del periodo, las cifras y el gráfico. */
export function StatisticsSkeleton() {
  const styles = useStyles();
  return (
    <SkeletonPulse label="Cargando estadísticas">
      <View style={styles.container}>
        <View style={styles.row}>
          <Skeleton height={minTouchSize} style={[styles.pill, styles.flex]} />
          <Skeleton height={minTouchSize} style={[styles.pill, styles.flex]} />
        </View>
        <Skeleton width="55%" height={fontSize.md} style={styles.center} />
        <View style={styles.row}>
          <Skeleton height={TILE_HEIGHT} style={[styles.rounded, styles.flex]} />
          <Skeleton height={TILE_HEIGHT} style={[styles.rounded, styles.flex]} />
        </View>
        <View style={styles.row}>
          <Skeleton height={TILE_HEIGHT} style={[styles.rounded, styles.flex]} />
          <Skeleton height={TILE_HEIGHT} style={[styles.rounded, styles.flex]} />
        </View>
        <View style={styles.card}>
          <Skeleton width="40%" height={fontSize.lg} />
          <Skeleton height={CHART_HEIGHT} style={styles.rounded} />
        </View>
      </View>
    </SkeletonPulse>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, gap: spacing.lg },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  rounded: { borderRadius: radius.lg },
  pill: { borderRadius: radius.pill },
  center: { alignSelf: 'center' },
  // Igual que `section` de StatisticsScreen: tarjeta tonal.
  card: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceTint },
}));
