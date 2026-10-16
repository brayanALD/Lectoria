import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import type { ReadingStatus, UserBookWithId } from '../types/book';
import { makeStyles, useTheme } from '../context/ThemeContext';
import type { ColorTokens } from '../theme/colors';
import { elevation } from '../theme/elevation';
import { iconSize, opacity, radius, spacing } from '../theme/spacing';
import { fontFamily, fontSize, maxFontScale } from '../theme/typography';
import { READING_STATUS_LABELS, getProgressPercent } from '../utils/book';
import { BookCover } from './BookCover';
import { PressableScale } from './PressableScale';
import { ReadingProgress } from './ReadingProgress';

interface BookCardProps {
  book: UserBookWithId;
  /** `list`: portada a la izquierda y datos a la derecha. `grid`: portada arriba, para cuadrículas de varias columnas. */
  variant?: 'list' | 'grid';
  onPress?: (book: UserBookWithId) => void;
}

// El estado se comunica con un punto y su nombre (nunca solo con el color): lleno = en curso o hecho, hueco = por empezar.
// Todos los colores son de la paleta y su texto va en `textPrimary`.
const dotStyles = (colors: ColorTokens): Record<ReadingStatus, { background: string; border: string }> => ({
  want_to_read: { background: 'transparent', border: colors.primary },
  reading: { background: colors.primary, border: colors.primary },
  paused: { background: colors.accent, border: colors.accent },
  finished: { background: colors.textPrimary, border: colors.textPrimary },
  abandoned: { background: 'transparent', border: colors.textSecondary },
});

// Geometría local: el punto del estado, el relleno de la tarjeta y la separación entre portada y datos.
const DOT_SIZE = spacing.sm;
const CARD_PADDING = spacing.sm + spacing.xs;
const WISHLIST_ICON_SIZE = iconSize.sm - spacing.xs;

const LIST_COVER_WIDTH = 60;

export function BookCard({ book, variant = 'list', onPress }: BookCardProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const isGrid = variant === 'grid';
  const authors = book.authors.join(', ');
  // Un deseo aún no se ha empezado: en lugar del estado de lectura se rotula como «Deseo».
  const isWish = book.acquisition === 'wishlist';
  const statusLabel = isWish ? 'Deseo' : READING_STATUS_LABELS[book.status];
  const percent = getProgressPercent(book);
  const showProgress = (book.status === 'reading' || book.status === 'paused') && percent !== undefined;
  const dot = dotStyles(colors)[book.status];

  const accessibilityLabel = [
    book.title,
    authors && `de ${authors}`,
    statusLabel,
    showProgress && `${percent} % leído`,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <PressableScale
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
        <View style={styles.statusRow}>
          {isWish ? (
            <Ionicons name="bookmark-outline" size={WISHLIST_ICON_SIZE} color={colors.primary} accessible={false} />
          ) : (
            <View style={[styles.dot, { backgroundColor: dot.background, borderColor: dot.border }]} accessible={false} />
          )}
          <Text style={styles.statusText} maxFontSizeMultiplier={maxFontScale}>
            {statusLabel}
          </Text>
        </View>

        {showProgress ? <ReadingProgress percent={percent} /> : null}
      </View>
    </PressableScale>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  card: {
    // Opaca (no `surfaceTint`) porque lleva sombra: con un fondo translúcido la sombra se vería a través.
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.lg,
    padding: CARD_PADDING,
    ...elevation.low,
  },
  cardList: { flexDirection: 'row', gap: CARD_PADDING, alignItems: 'flex-start' },
  cardGrid: { gap: spacing.sm },
  pressed: { opacity: opacity.pressed },
  infoList: { flex: 1, gap: spacing.xs },
  infoGrid: { gap: spacing.xs },
  title: { fontSize: fontSize.md, fontFamily: fontFamily.display, color: colors.textPrimary },
  secondary: { fontSize: fontSize.sm, fontFamily: fontFamily.regular, color: colors.textSecondary },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginVertical: spacing.xs },
  dot: { width: DOT_SIZE, height: DOT_SIZE, borderRadius: DOT_SIZE / 2, borderWidth: 1.5 },
  statusText: { fontSize: fontSize.sm, fontFamily: fontFamily.semibold, color: colors.textPrimary },
}));
