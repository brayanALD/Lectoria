import { StyleSheet, View } from 'react-native';

import { makeStyles } from '../context/ThemeContext';
import { radius, spacing } from '../theme/spacing';
import { fontSize } from '../theme/typography';
import { ListCardSkeleton } from './BookSkeletons';
import { NAV_ROW_BADGE, NAV_ROW_HEIGHT } from './NavRow';
import { Skeleton, SkeletonPulse } from './Skeleton';

const ROW_PLACEHOLDERS = 6;
const CARD_PLACEHOLDERS = 4;
// Separación entre tarjetas (la misma que `BookCardList`).
const CARD_GAP = spacing.sm + spacing.xs;

/** Silueta de una lista de filas (`NavRow`): Colecciones, Sagas y Autores. Mide lo mismo que la fila real. */
export function RowListSkeleton({ label, icons = false }: { label: string; icons?: boolean }) {
  const styles = useStyles();
  return (
    <SkeletonPulse label={label}>
      <View style={styles.list}>
        {Array.from({ length: ROW_PLACEHOLDERS }, (_, i) => (
          <View key={i} style={[styles.row, { minHeight: NAV_ROW_HEIGHT }]}>
            {icons ? <Skeleton width={NAV_ROW_BADGE} height={NAV_ROW_BADGE} style={styles.badge} /> : null}
            <View style={styles.text}>
              <Skeleton width="60%" height={fontSize.md} />
              <Skeleton width="40%" height={fontSize.sm} />
            </View>
          </View>
        ))}
      </View>
    </SkeletonPulse>
  );
}

/** Silueta de una pantalla de detalle de autor, saga o colección: el nombre, una línea de resumen y las tarjetas. */
export function BookListSkeleton({ label }: { label: string }) {
  const styles = useStyles();
  return (
    <SkeletonPulse label={label}>
      <View style={styles.detail}>
        <Skeleton width="55%" height={fontSize.xl} />
        <Skeleton width="35%" height={fontSize.sm} />
        <View style={styles.cards}>
          {Array.from({ length: CARD_PLACEHOLDERS }, (_, i) => (
            <ListCardSkeleton key={i} />
          ))}
        </View>
      </View>
    </SkeletonPulse>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  list: { padding: spacing.lg, gap: CARD_GAP },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceTint,
  },
  badge: { borderRadius: radius.pill },
  text: { flex: 1, gap: spacing.sm },
  detail: { padding: spacing.lg, gap: spacing.sm },
  cards: { gap: CARD_GAP, marginTop: spacing.sm },
}));
