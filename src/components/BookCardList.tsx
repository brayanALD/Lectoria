import type { ReactElement, ReactNode } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { makeStyles } from '../context/ThemeContext';
import type { UserBookWithId } from '../types/book';
import { spacing } from '../theme/spacing';
import { fontFamily, fontSize, maxFontScale } from '../theme/typography';
import { BookCard } from './BookCard';

interface BookCardListProps {
  books: readonly UserBookWithId[];
  /** Lo que va encima de las tarjetas (nombre, resumen, acciones). Se desplaza con la lista. */
  header?: ReactElement;
  /** Se pinta en lugar de las tarjetas cuando no hay libros. */
  empty?: ReactElement;
  onOpenBook: (book: UserBookWithId) => void;
  /** Texto a la izquierda de cada tarjeta (p. ej. el número del libro en su saga). */
  leading?: (book: UserBookWithId, index: number) => ReactNode;
}

// Separación entre tarjetas: la misma que usa Biblioteca.
const CARD_GAP = spacing.sm + spacing.xs;
const LEADING_WIDTH = spacing.xl;

/**
 * Las tarjetas de una lista de libros con una cabecera propia: la base de las pantallas de detalle de un autor, una saga
 * y una colección. Tocar una tarjeta abre el libro.
 */
export function BookCardList({ books, header, empty, onOpenBook, leading }: BookCardListProps) {
  const styles = useStyles();
  return (
    <FlatList
      data={books}
      keyExtractor={(book) => book.id}
      contentContainerStyle={styles.content}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      ItemSeparatorComponent={Separator}
      renderItem={({ item, index }) => {
        const lead = leading?.(item, index);
        return (
          <View style={styles.row}>
            {lead !== undefined && lead !== null ? (
              <Text style={styles.leading} maxFontSizeMultiplier={maxFontScale}>
                {lead}
              </Text>
            ) : null}
            <View style={styles.card}>
              <BookCard book={item} onPress={onOpenBook} />
            </View>
          </View>
        );
      }}
    />
  );
}

function Separator() {
  const styles = useStyles();
  return <View style={styles.separator} />;
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  leading: { width: LEADING_WIDTH, fontSize: fontSize.sm, fontFamily: fontFamily.bold, color: colors.textSecondary },
  card: { flex: 1 },
  separator: { height: CARD_GAP },
}));
