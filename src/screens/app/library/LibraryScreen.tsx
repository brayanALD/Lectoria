import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { BookCard } from '../../../components/BookCard';
import { Button } from '../../../components/Button';
import { EmptyState } from '../../../components/EmptyState';
import { LoadingSpinner } from '../../../components/LoadingSpinner';
import { useBooks } from '../../../hooks/useBooks';
import { colors } from '../../../theme/colors';
import { minTouchSize, radius, spacing } from '../../../theme/spacing';
import { fontSize, fontWeight } from '../../../theme/typography';
import { formatBookCount } from '../../../utils/book';

type ViewMode = 'list' | 'grid';

const GRID_COLUMNS = 2;

export function LibraryScreen() {
  const { books, loading, error, retry } = useBooks();
  const [mode, setMode] = useState<ViewMode>('list');

  if (loading) return <LoadingSpinner />;

  // Error sin datos que mostrar: pantalla completa. Con datos previos se muestra la lista y un aviso.
  if (error && books.length === 0) {
    return (
      <EmptyState
        icon="cloud-offline-outline"
        title="No se pudo cargar tu biblioteca"
        description={error}
        action={{ label: 'Reintentar', onPress: retry }}
      />
    );
  }

  if (books.length === 0) {
    return (
      <EmptyState
        icon="library-outline"
        title="Tu biblioteca está vacía"
        description="Cuando añadas libros aparecerán aquí."
      />
    );
  }

  const isGrid = mode === 'grid';

  return (
    <View style={styles.container}>
      {error ? (
        <View style={styles.banner} accessibilityRole="alert">
          <Text style={styles.bannerText}>{error}</Text>
          <Button title="Reintentar" variant="secondary" onPress={retry} />
        </View>
      ) : null}

      <View style={styles.toolbar}>
        <Text style={styles.count} accessibilityLiveRegion="polite">
          {formatBookCount(books.length)}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isGrid ? 'Cambiar a vista de lista' : 'Cambiar a vista de cuadrícula'}
          onPress={() => setMode(isGrid ? 'list' : 'grid')}
          style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}
        >
          <Ionicons name={isGrid ? 'list-outline' : 'grid-outline'} size={24} color={colors.primary} />
        </Pressable>
      </View>

      {/* Cambiar numColumns en caliente no está soportado por FlatList: se remonta al cambiar de vista. */}
      <FlatList
        key={mode}
        data={books}
        keyExtractor={(book) => book.id}
        numColumns={isGrid ? GRID_COLUMNS : 1}
        columnWrapperStyle={isGrid ? styles.gridRow : undefined}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={isGrid ? undefined : ListSeparator}
        renderItem={({ item }) => (
          <View style={isGrid ? styles.gridCell : undefined}>
            <BookCard book={item} variant={isGrid ? 'grid' : 'list'} />
          </View>
        )}
      />
    </View>
  );
}

function ListSeparator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  banner: {
    margin: spacing.md,
    marginBottom: 0,
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.error,
  },
  bannerText: { fontSize: fontSize.sm, color: colors.error },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  count: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textSecondary },
  toggle: { width: minTouchSize, height: minTouchSize, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  listContent: { padding: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xl * 2 },
  separator: { height: spacing.md },
  gridRow: { gap: spacing.md, marginBottom: spacing.md },
  // maxWidth evita que una última fila con un solo libro lo estire a todo el ancho.
  gridCell: { flex: 1, maxWidth: `${100 / GRID_COLUMNS}%` },
});
