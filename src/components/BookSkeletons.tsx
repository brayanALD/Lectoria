import { StyleSheet, View } from 'react-native';

import { minTouchSize, radius, spacing } from '../theme/spacing';
import { colors } from '../theme/colors';
import { fontSize } from '../theme/typography';
import { Skeleton, SkeletonPulse } from './Skeleton';

// Medidas que coinciden con las de los componentes reales, para que al llegar los datos nada «salte».
const LIST_COVER_WIDTH = 64;
const DETAIL_COVER_WIDTH = 112;
const COVER_RATIO = 2 / 3;
// Dos columnas con el espacio entre ellas.
const GRID_CELL_WIDTH = '47%';
const PLACEHOLDER_ITEMS = 6;
const FORM_FIELDS = 6;
const SESSION_PLACEHOLDERS = 3;

function ListCardSkeleton() {
  return (
    <View style={[styles.card, styles.cardList]}>
      <Skeleton width={LIST_COVER_WIDTH} height={LIST_COVER_WIDTH / COVER_RATIO} />
      <View style={styles.cardInfo}>
        <Skeleton width="80%" height={fontSize.md} />
        <Skeleton width="50%" height={fontSize.sm} />
        <Skeleton width="35%" height={fontSize.md + spacing.xs} />
      </View>
    </View>
  );
}

function GridCardSkeleton() {
  return (
    <View style={[styles.card, styles.gridCell]}>
      <Skeleton height={0} style={{ aspectRatio: COVER_RATIO }} />
      <Skeleton width="80%" height={fontSize.md} />
      <Skeleton width="50%" height={fontSize.sm} />
    </View>
  );
}

/** Silueta de la pantalla de Biblioteca: buscador, etiquetas de estado y tarjetas. */
export function LibrarySkeleton({ grid = false }: { grid?: boolean }) {
  return (
    <SkeletonPulse label="Cargando biblioteca">
      <View style={styles.library}>
        <View style={styles.searchRow}>
          <Skeleton width="85%" height={minTouchSize} style={styles.rounded} />
          <Skeleton width={minTouchSize} height={minTouchSize} style={styles.rounded} />
        </View>
        <View style={styles.chipRow}>
          <Skeleton width={72} height={minTouchSize} style={styles.rounded} />
          <Skeleton width={120} height={minTouchSize} style={styles.rounded} />
          <Skeleton width={96} height={minTouchSize} style={styles.rounded} />
        </View>
        {grid ? (
          <View style={styles.grid}>
            {Array.from({ length: PLACEHOLDER_ITEMS }, (_, i) => (
              <GridCardSkeleton key={i} />
            ))}
          </View>
        ) : (
          <View style={styles.list}>
            {Array.from({ length: PLACEHOLDER_ITEMS }, (_, i) => (
              <ListCardSkeleton key={i} />
            ))}
          </View>
        )}
      </View>
    </SkeletonPulse>
  );
}

/** Silueta del formulario de libro: una etiqueta y un campo por fila. */
export function BookFormSkeleton() {
  return (
    <SkeletonPulse label="Cargando formulario">
      <View style={styles.form}>
        {Array.from({ length: FORM_FIELDS }, (_, i) => (
          <View key={i} style={styles.formField}>
            <Skeleton width="30%" height={fontSize.sm} />
            <Skeleton height={minTouchSize} style={styles.rounded} />
          </View>
        ))}
      </View>
    </SkeletonPulse>
  );
}

/** Silueta del detalle del libro: portada, título, estados y progreso. */
export function BookDetailSkeleton() {
  return (
    <SkeletonPulse label="Cargando libro">
      <View style={styles.detail}>
        <View style={styles.detailHeader}>
          <Skeleton width={DETAIL_COVER_WIDTH} height={DETAIL_COVER_WIDTH / COVER_RATIO} />
          <View style={styles.cardInfo}>
            <Skeleton width="90%" height={fontSize.xl} />
            <Skeleton width="60%" height={fontSize.md} />
          </View>
        </View>
        <View style={styles.chipRow}>
          <Skeleton width={110} height={minTouchSize} style={styles.rounded} />
          <Skeleton width={90} height={minTouchSize} style={styles.rounded} />
          <Skeleton width={100} height={minTouchSize} style={styles.rounded} />
        </View>
        <Skeleton width="40%" height={fontSize.md} />
        <Skeleton height={spacing.sm} />
        <Skeleton width="70%" height={fontSize.md} />
        <Skeleton width="55%" height={fontSize.md} />
      </View>
    </SkeletonPulse>
  );
}

/** Filas de sesiones en silueta (sin el latido): para incrustarlas en otra silueta o en `SessionListSkeleton`. */
export function SessionRowsSkeleton({ count = SESSION_PLACEHOLDERS }: { count?: number }) {
  return (
    <View>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={styles.sessionRow}>
          <Skeleton width="55%" height={fontSize.md} />
          <Skeleton width="35%" height={fontSize.sm} />
        </View>
      ))}
    </View>
  );
}

/** Silueta de la sección «Lecturas» del detalle del libro: el resumen y unas filas de sesiones. */
export function SessionListSkeleton() {
  return (
    <SkeletonPulse label="Cargando lecturas">
      <View style={styles.sessionList}>
        <Skeleton width="30%" height={fontSize.lg} />
        <Skeleton width="60%" height={fontSize.md} />
        <SessionRowsSkeleton />
      </View>
    </SkeletonPulse>
  );
}

const styles = StyleSheet.create({
  library: { flex: 1, paddingTop: spacing.sm, gap: spacing.sm },
  searchRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg },
  chipRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg },
  rounded: { borderRadius: radius.md },
  list: { padding: spacing.lg, gap: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', padding: spacing.lg, gap: spacing.md },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  cardList: { flexDirection: 'row', gap: spacing.md },
  cardInfo: { flex: 1, gap: spacing.sm },
  gridCell: { width: GRID_CELL_WIDTH, gap: spacing.sm },
  form: { padding: spacing.lg, gap: spacing.md },
  formField: { gap: spacing.xs },
  detail: { padding: spacing.lg, gap: spacing.lg },
  detailHeader: { flexDirection: 'row', gap: spacing.md },
  // Igual que la fila real (`SessionRow`): separador arriba, texto en dos líneas y alto táctil mínimo.
  sessionList: { gap: spacing.sm },
  sessionRow: {
    minHeight: minTouchSize,
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
