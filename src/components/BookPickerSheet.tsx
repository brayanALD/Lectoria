import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import type { UserBookWithId } from '../types/book';
import { colors } from '../theme/colors';
import { minTouchSize, opacity, radius, spacing } from '../theme/spacing';
import { fontSize, fontWeight } from '../theme/typography';
import { READING_STATUS_LABELS } from '../utils/book';
import { sortBooksForSession } from '../utils/sessionBooks';
import { Sheet } from './Sheet';

interface BookPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  books: readonly UserBookWithId[];
  selectedId?: string;
  onPick: (book: UserBookWithId) => void;
}

/** Elegir uno de los libros de la biblioteca: primero los que se están leyendo. Al elegir uno se cierra sola. */
export function BookPickerSheet({ visible, onClose, books, selectedId, onPick }: BookPickerSheetProps) {
  return (
    <Sheet visible={visible} onClose={onClose}>
      <ScrollView contentContainerStyle={styles.list}>
        {sortBooksForSession(books).map((book) => {
          const selected = book.id === selectedId;
          return (
            <Pressable
              key={book.id}
              accessibilityRole="button"
              accessibilityLabel={`${book.title}, ${READING_STATUS_LABELS[book.status]}`}
              accessibilityState={{ selected }}
              onPress={() => {
                onPick(book);
                onClose();
              }}
              style={({ pressed }) => [styles.row, selected && styles.rowSelected, pressed && styles.pressed]}
            >
              <Text style={[styles.title, { color: selected ? colors.onPrimary : colors.textPrimary }]} numberOfLines={1}>
                {book.title}
              </Text>
              <Text style={[styles.status, { color: selected ? colors.onPrimary : colors.textSecondary }]}>
                {READING_STATUS_LABELS[book.status]}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm, paddingBottom: spacing.md },
  row: {
    minHeight: minTouchSize,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  rowSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  pressed: { opacity: opacity.pressed },
  title: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  status: { fontSize: fontSize.sm },
});
