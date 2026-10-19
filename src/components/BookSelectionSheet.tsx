import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { makeStyles, useTheme } from '../context/ThemeContext';
import type { UserBookWithId } from '../types/book';
import { iconSize, minTouchSize, opacity, radius, spacing } from '../theme/spacing';
import { fontFamily, fontSize } from '../theme/typography';
import { formatBookCount } from '../utils/book';
import { searchBooks } from '../utils/collections';
import { Button } from './Button';
import { Sheet } from './Sheet';
import { TextField } from './TextField';

interface BookSelectionSheetProps {
  visible: boolean;
  onClose: () => void;
  books: readonly UserBookWithId[];
  selectedIds: readonly string[];
  /** Añade el libro si no estaba elegido y lo quita si lo estaba. */
  onToggle: (bookId: string) => void;
}

/**
 * Elegir varios libros de la biblioteca (propios y deseos) con un buscador. Cada fila muestra con un icono y con su
 * estado accesible si está elegida; «Listo» cierra la hoja con la cuenta de libros elegidos.
 */
export function BookSelectionSheet({ visible, onClose, books, selectedIds, onToggle }: BookSelectionSheetProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const shown = useMemo(() => searchBooks(books, query), [books, query]);

  return (
    <Sheet visible={visible} onClose={onClose}>
      <TextField
        label="Buscar libros"
        placeholder="Título o autor"
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
      />
      <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled" style={styles.scroll}>
        {shown.length === 0 ? (
          <Text style={styles.empty}>Ningún libro coincide</Text>
        ) : (
          shown.map((book) => {
            const checked = selected.has(book.id);
            return (
              <Pressable
                key={book.id}
                accessibilityRole="checkbox"
                accessibilityLabel={`${book.title}, ${book.authors.join(', ')}${book.acquisition === 'wishlist' ? ', deseo' : ''}`}
                accessibilityState={{ checked }}
                onPress={() => onToggle(book.id)}
                style={({ pressed }) => [styles.row, checked && styles.rowChecked, pressed && styles.pressed]}
              >
                <Ionicons
                  name={checked ? 'checkmark-circle' : 'ellipse-outline'}
                  size={iconSize.md}
                  color={checked ? colors.primary : colors.textSecondary}
                  accessible={false}
                />
                <View style={styles.text}>
                  <Text style={styles.title} numberOfLines={1}>
                    {book.title}
                  </Text>
                  <Text style={styles.authors} numberOfLines={1}>
                    {book.acquisition === 'wishlist' ? `Deseo · ${book.authors.join(', ')}` : book.authors.join(', ')}
                  </Text>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
      <Button title={`Listo, ${formatBookCount(selectedIds.length)}`} onPress={onClose} />
    </Sheet>
  );
}

// La hoja no crece sin límite: la lista se desplaza dentro de una altura acotada.
const LIST_MAX_HEIGHT = minTouchSize * 7;

const useStyles = makeStyles((colors) => StyleSheet.create({
  scroll: { maxHeight: LIST_MAX_HEIGHT },
  list: { gap: spacing.sm, paddingVertical: spacing.sm },
  row: {
    minHeight: minTouchSize,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  rowChecked: { borderColor: colors.primary },
  pressed: { opacity: opacity.pressed },
  text: { flex: 1 },
  title: { fontSize: fontSize.md, fontFamily: fontFamily.semibold, color: colors.textPrimary },
  authors: { fontSize: fontSize.sm, fontFamily: fontFamily.regular, color: colors.textSecondary },
  empty: { fontSize: fontSize.md, fontFamily: fontFamily.regular, color: colors.textSecondary, paddingVertical: spacing.md },
}));
