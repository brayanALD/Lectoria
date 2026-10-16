import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useLayoutEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { BookCard } from '../../../components/BookCard';
import { BookFilters } from '../../../components/BookFilters';
import { Button } from '../../../components/Button';
import { EmptyState } from '../../../components/EmptyState';
import { LibrarySkeleton } from '../../../components/BookSkeletons';
import { SettingsButton } from '../../../components/SettingsButton';
import { useBooks } from '../../../hooks/useBooks';
import type { AppStackParamList } from '../../../navigation/types';
import { makeStyles, useTheme } from '../../../context/ThemeContext';
import { iconSize, minTouchSize, opacity, radius, spacing } from '../../../theme/spacing';
import { fontFamily, fontSize } from '../../../theme/typography';
import {
  EMPTY_FILTERS,
  clearFilters,
  filterBooks,
  filterByAcquisition,
  getFilterOptions,
  type BookFilterState,
} from '../../../utils/bookFilters';

type ViewMode = 'list' | 'grid';

const GRID_COLUMNS = 2;
// Separación entre tarjetas (la misma que su relleno).
const CARD_GAP = spacing.sm + spacing.xs;

export function LibraryScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { books, loading, error, retry } = useBooks();
  const [mode, setMode] = useState<ViewMode>('list');
  const [filters, setFilters] = useState<BookFilterState>(EMPTY_FILTERS);
  // La lista que se ve (libros propios o deseos): el recuento y las opciones de filtro salen de ella.
  const wishlistMode = filters.acquisition === 'wishlist';
  const scopedBooks = useMemo(() => filterByAcquisition(books, filters.acquisition), [books, filters.acquisition]);
  const visibleBooks = useMemo(() => filterBooks(books, filters), [books, filters]);
  const filterOptions = useMemo(() => getFilterOptions(scopedBooks), [scopedBooks]);
  // Los números de las pestañas: cuántos libros tiene cada lista.
  const counts = useMemo(
    () => ({ owned: filterByAcquisition(books, 'owned').length, wishlist: filterByAcquisition(books, 'wishlist').length }),
    [books],
  );
  // Desde una pestaña, navigate sube hasta el stack que contiene «AddBook». «Añadir» sigue a la lista que se ve.
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const openAddBook = () => navigation.navigate('AddBook', { acquisition: filters.acquisition });

  // Botón «Añadir» en el encabezado: visible también mientras carga, en error o con la biblioteca vacía.
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={wishlistMode ? 'Añadir a deseos' : 'Añadir libro'}
            onPress={openAddBook}
            hitSlop={spacing.sm}
            style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
          >
            <Ionicons name="add" size={iconSize.lg} color={colors.primary} />
          </Pressable>
          <SettingsButton />
        </View>
      ),
    });
    // El botón se repinta al cambiar el tema o de lista (libros o deseos).
  }, [navigation, styles, colors, filters.acquisition]);

  if (loading) return <LibrarySkeleton grid={mode === 'grid'} />;

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

  const isGrid = mode === 'grid';

  return (
    <View style={styles.container}>
      {error ? (
        <View style={styles.banner} accessibilityRole="alert">
          <Text style={styles.bannerText}>{error}</Text>
          <Button title="Reintentar" variant="secondary" onPress={retry} />
        </View>
      ) : null}

      <BookFilters
        filters={filters}
        onChange={setFilters}
        options={filterOptions}
        counts={counts}
        resultCount={visibleBooks.length}
        accessory={
          scopedBooks.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isGrid ? 'Cambiar a vista de lista' : 'Cambiar a vista de cuadrícula'}
              onPress={() => setMode(isGrid ? 'list' : 'grid')}
              style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}
            >
              <Ionicons name={isGrid ? 'list-outline' : 'grid-outline'} size={iconSize.md} color={colors.primary} />
            </Pressable>
          ) : null
        }
      />

      {/* Cambiar numColumns en caliente no está soportado por FlatList: la lista se remonta al cambiar de vista. */}
      {scopedBooks.length === 0 ? (
        <EmptyState
          icon={wishlistMode ? 'bookmark-outline' : 'library-outline'}
          title={wishlistMode ? 'Tu lista de deseos está vacía' : 'Tu biblioteca está vacía'}
          action={{ label: wishlistMode ? 'Añadir a deseos' : 'Añadir libro', onPress: openAddBook }}
        />
      ) : (
        <FlatList
          key={mode}
          data={visibleBooks}
          keyExtractor={(book) => book.id}
          numColumns={isGrid ? GRID_COLUMNS : 1}
          columnWrapperStyle={isGrid ? styles.gridRow : undefined}
          contentContainerStyle={[styles.listContent, visibleBooks.length === 0 && styles.growContent]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ItemSeparatorComponent={isGrid ? undefined : ListSeparator}
          ListEmptyComponent={
            <EmptyState
              icon="search-outline"
              title="Ningún libro coincide"
              action={{ label: 'Limpiar búsqueda y filtros', onPress: () => setFilters(clearFilters(filters)) }}
            />
          }
          renderItem={({ item }) => (
            <View style={isGrid ? styles.gridCell : undefined}>
              <BookCard
                book={item}
                variant={isGrid ? 'grid' : 'list'}
                onPress={(book) => navigation.navigate('BookDetail', { bookId: book.id })}
              />
            </View>
          )}
        />
      )}
    </View>
  );
}

function ListSeparator() {
  const styles = useStyles();
  return <View style={styles.separator} />;
}

const useStyles = makeStyles((colors) => StyleSheet.create({
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
  bannerText: { fontSize: fontSize.sm, fontFamily: fontFamily.regular, color: colors.error },
  toggle: { width: minTouchSize, height: minTouchSize, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: opacity.pressed },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  headerButton: { width: minTouchSize, height: minTouchSize, alignItems: 'center', justifyContent: 'center' },
  listContent: { padding: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xl * 2 },
  growContent: { flexGrow: 1 },
  separator: { height: CARD_GAP },
  gridRow: { gap: CARD_GAP, marginBottom: CARD_GAP },
  // maxWidth evita que una última fila con un solo libro lo estire a todo el ancho.
  gridCell: { flex: 1, maxWidth: `${100 / GRID_COLUMNS}%` },
}));
