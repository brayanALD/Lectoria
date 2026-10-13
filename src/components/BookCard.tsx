import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ReadingStatus, UserBookWithId } from '../types/book';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { fontSize, fontWeight } from '../theme/typography';
import { READING_STATUS_LABELS, getProgressPercent } from '../utils/book';
import { BookCover } from './BookCover';
import { ReadingProgress } from './ReadingProgress';

interface BookCardProps {
  book: UserBookWithId;
  /** `list`: portada a la izquierda y datos a la derecha. `grid`: portada arriba, para cuadrículas de varias columnas. */
  variant?: 'list' | 'grid';
  onPress?: (book: UserBookWithId) => void;
}

// Colores de la paleta; todos cumplen contraste AA entre texto y fondo (ver sección 5 del plan).
const BADGE_STYLES: Record<ReadingStatus, { background: string; foreground: string; border: string }> = {
  want_to_read: { background: 'transparent', foreground: colors.primary, border: colors.primary },
  reading: { background: colors.primary, foreground: colors.onPrimary, border: colors.primary },
  paused: { background: colors.accent, foreground: colors.onAccent, border: colors.accent },
  finished: { background: colors.textPrimary, foreground: colors.background, border: colors.textPrimary },
  abandoned: { background: 'transparent', foreground: colors.textSecondary, border: colors.textSecondary },
};

const LIST_COVER_WIDTH = 64;

export function BookCard({ book, variant = 'list', onPress }: BookCardProps) {
  const isGrid = variant === 'grid';
  const authors = book.authors.join(', ');
  const series = book.seriesName
    ? `${book.seriesName}${book.seriesOrder !== undefined ? ` #${book.seriesOrder}` : ''}`
    : undefined;
  const statusLabel = READING_STATUS_LABELS[book.status];
  const percent = getProgressPercent(book);
  const showProgress = (book.status === 'reading' || book.status === 'paused') && percent !== undefined;
  const badge = BADGE_STYLES[book.status];

  const accessibilityLabel = [
    book.title,
    authors && `de ${authors}`,
    statusLabel,
    showProgress && `${percent} % leído`,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="Abre el detalle del libro"
      onPress={onPress ? () => onPress(book) : undefined}
      style={({ pressed }) => [styles.card, isGrid ? styles.cardGrid : styles.cardList, pressed && styles.pressed]}
    >
      {isGrid ? (
        <BookCover title={book.title} coverUrl={book.coverUrl} />
      ) : (
        <BookCover title={book.title} coverUrl={book.coverUrl} width={LIST_COVER_WIDTH} />
      )}

      <View style={isGrid ? styles.infoGrid : styles.infoList}>
        <Text style={styles.title} numberOfLines={2}>
          {book.title}
        </Text>
        {authors ? (
          <Text style={styles.secondary} numberOfLines={1}>
            {authors}
          </Text>
        ) : null}
        {series ? (
          <Text style={styles.series} numberOfLines={1}>
            {series}
          </Text>
        ) : null}

        <View style={styles.badgeRow}>
          <View style={[styles.badge, { backgroundColor: badge.background, borderColor: badge.border }]}>
            <Text style={[styles.badgeText, { color: badge.foreground }]}>{statusLabel}</Text>
          </View>
        </View>

        {showProgress ? <ReadingProgress percent={percent} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  cardList: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  cardGrid: { gap: spacing.sm },
  pressed: { opacity: 0.85 },
  infoList: { flex: 1, gap: spacing.xs },
  infoGrid: { gap: spacing.xs },
  title: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  secondary: { fontSize: fontSize.sm, color: colors.textSecondary },
  series: { fontSize: fontSize.sm, color: colors.textSecondary, fontStyle: 'italic' },
  badgeRow: { flexDirection: 'row', marginVertical: spacing.xs },
  badge: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  badgeText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
});
