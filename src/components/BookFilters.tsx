import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../theme/colors';
import { minTouchSize, radius, spacing } from '../theme/spacing';
import { fontSize, fontWeight } from '../theme/typography';
import { READING_STATUSES, READING_STATUS_LABELS } from '../utils/book';
import { countActiveFilters, type BookFilterOptions, type BookFilterState } from '../utils/bookFilters';
import { Button } from './Button';
import { Chip } from './Chip';

interface BookFiltersProps {
  filters: BookFilterState;
  onChange: (filters: BookFilterState) => void;
  /** Valores disponibles para género, autor y saga, calculados a partir de la biblioteca. */
  options: BookFilterOptions;
}

type SheetFilter = 'genre' | 'author' | 'series';

const SHEET_SECTIONS: { key: SheetFilter; title: string; empty: string; options: keyof BookFilterOptions }[] = [
  { key: 'genre', title: 'Género', empty: 'Ningún libro tiene género todavía.', options: 'genres' },
  { key: 'author', title: 'Autor', empty: 'Aún no hay autores.', options: 'authors' },
  { key: 'series', title: 'Saga', empty: 'Ningún libro pertenece a una saga todavía.', options: 'series' },
];

/** Búsqueda de texto, filtro por estado (siempre visible) y hoja con los filtros de género, autor y saga. */
export function BookFilters({ filters, onChange, options }: BookFiltersProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const activeCount = countActiveFilters({ ...filters, status: null });

  const set = (changes: Partial<BookFilterState>) => onChange({ ...filters, ...changes });

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <View style={styles.search}>
          <Ionicons name="search" size={20} color={colors.textSecondary} accessible={false} />
          <TextInput
            accessibilityLabel="Buscar libros"
            placeholder="Buscar por título, autor, saga o género"
            placeholderTextColor={colors.textSecondary}
            value={filters.query}
            onChangeText={(query) => set({ query })}
            style={styles.searchInput}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {filters.query ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Borrar búsqueda"
              hitSlop={spacing.sm}
              onPress={() => set({ query: '' })}
            >
              <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
            </Pressable>
          ) : null}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={activeCount > 0 ? `Más filtros, ${activeCount} activos` : 'Más filtros'}
          onPress={() => setSheetOpen(true)}
          style={({ pressed }) => [styles.filterButton, pressed && styles.pressed]}
        >
          <Ionicons name="options-outline" size={24} color={colors.primary} />
          {activeCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{activeCount}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.chipRow}
      >
        <Chip label="Todos" selected={filters.status === null} onPress={() => set({ status: null })} />
        {READING_STATUSES.map((status) => (
          <Chip
            key={status}
            label={READING_STATUS_LABELS[status]}
            selected={filters.status === status}
            onPress={() => set({ status: filters.status === status ? null : status })}
          />
        ))}
      </ScrollView>

      <Modal
        visible={sheetOpen}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setSheetOpen(false)}
      >
        <Pressable
          style={styles.overlay}
          onPress={() => setSheetOpen(false)}
          accessibilityRole="button"
          accessibilityLabel="Cerrar filtros"
        />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}>
          <Text style={styles.sheetTitle} accessibilityRole="header">
            Filtros
          </Text>

          <ScrollView contentContainerStyle={styles.sheetContent}>
            {SHEET_SECTIONS.map((section) => {
              const selected = filters[section.key];
              // Si el valor elegido ya no existe en la biblioteca (p. ej. se eliminó el libro) sigue visible para poder quitarlo.
              const values = options[section.options];
              const shown = selected && !values.includes(selected) ? [selected, ...values] : values;

              return (
                <View key={section.key} style={styles.section}>
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                  {shown.length === 0 ? (
                    <Text style={styles.empty}>{section.empty}</Text>
                  ) : (
                    <View style={styles.wrap}>
                      {shown.map((value) => (
                        <Chip
                          key={value}
                          label={value}
                          selected={selected === value}
                          onPress={() => set({ [section.key]: selected === value ? null : value })}
                        />
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>

          <View style={styles.sheetActions}>
            <Button
              title="Limpiar"
              variant="secondary"
              disabled={activeCount === 0}
              onPress={() => set({ genre: null, author: null, series: null })}
            />
            <Button title="Listo" onPress={() => setSheetOpen(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm, paddingTop: spacing.sm },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg },
  search: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: minTouchSize,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  searchInput: { flex: 1, fontSize: fontSize.md, color: colors.textPrimary, paddingVertical: 0 },
  filterButton: { width: minTouchSize, height: minTouchSize, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  badge: {
    position: 'absolute',
    top: 4,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 11, fontWeight: fontWeight.bold, color: colors.onAccent },
  chipRow: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  overlay: { flex: 1, backgroundColor: colors.overlay },
  sheet: {
    maxHeight: '80%',
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.md * 2,
    borderTopRightRadius: radius.md * 2,
    paddingTop: spacing.lg,
  },
  sheetTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    paddingHorizontal: spacing.lg,
  },
  sheetContent: { padding: spacing.lg, gap: spacing.lg },
  section: { gap: spacing.sm },
  sectionTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  empty: { fontSize: fontSize.sm, color: colors.textSecondary },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  sheetActions: { gap: spacing.sm, paddingHorizontal: spacing.lg },
});
