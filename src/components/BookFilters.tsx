import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { makeStyles, useTheme } from '../context/ThemeContext';
import { iconSize, minTouchSize, opacity, radius, spacing } from '../theme/spacing';
import { fontFamily, fontSize, maxFontScale } from '../theme/typography';
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

const SHEET_SECTIONS: { key: SheetFilter; title: string; options: keyof BookFilterOptions }[] = [
  { key: 'genre', title: 'Género', options: 'genres' },
  { key: 'author', title: 'Autor', options: 'authors' },
  { key: 'series', title: 'Saga', options: 'series' },
];

const BADGE_SIZE = spacing.md + spacing.xs;

/** Búsqueda de texto, filtro por estado (siempre visible) y hoja con los filtros de género, autor y saga. */
export function BookFilters({ filters, onChange, options }: BookFiltersProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [sheetOpen, setSheetOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const activeCount = countActiveFilters({ ...filters, status: null });

  const set = (changes: Partial<BookFilterState>) => onChange({ ...filters, ...changes });

  // Solo se muestran los criterios con opciones (o con un valor ya elegido que aún se pueda quitar).
  const sections = SHEET_SECTIONS.map((section) => {
    const selected = filters[section.key];
    const values = options[section.options];
    const shown = selected && !values.includes(selected) ? [selected, ...values] : values;
    return { ...section, selected, shown };
  }).filter((section) => section.shown.length > 0);

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <View style={styles.search}>
          <Ionicons name="search" size={iconSize.sm} color={colors.textSecondary} accessible={false} />
          <TextInput
            accessibilityLabel="Buscar libros"
            placeholder="Buscar libros"
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
              // Icono de 20 pt + 12 pt por lado = 44 pt de zona táctil.
              hitSlop={spacing.md - spacing.xs}
              onPress={() => set({ query: '' })}
            >
              <Ionicons name="close-circle" size={iconSize.sm} color={colors.textSecondary} />
            </Pressable>
          ) : null}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={activeCount > 0 ? `Más filtros, ${activeCount} activos` : 'Más filtros'}
          onPress={() => setSheetOpen(true)}
          style={({ pressed }) => [styles.filterButton, pressed && styles.pressed]}
        >
          <Ionicons name="options-outline" size={iconSize.md} color={colors.primary} />
          {activeCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText} maxFontSizeMultiplier={maxFontScale}>
                {activeCount}
              </Text>
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
        {/* accessibilityViewIsModal: el lector de pantalla no sale de la hoja hacia el contenido de detrás. */}
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]} accessibilityViewIsModal>
          <ScrollView contentContainerStyle={styles.sheetContent}>
            {sections.map((section) => (
              <View key={section.key} style={styles.section}>
                <Text style={styles.sectionTitle} accessibilityRole="header">
                  {section.title}
                </Text>
                <View style={styles.wrap}>
                  {section.shown.map((value) => (
                    <Chip
                      key={value}
                      label={value}
                      selected={section.selected === value}
                      onPress={() => set({ [section.key]: section.selected === value ? null : value })}
                    />
                  ))}
                </View>
              </View>
            ))}
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

const useStyles = makeStyles((colors) => StyleSheet.create({
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
    borderColor: colors.outline,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  searchInput: { flex: 1, fontSize: fontSize.md, fontFamily: fontFamily.regular, color: colors.textPrimary, paddingVertical: 0 },
  filterButton: { width: minTouchSize, height: minTouchSize, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: opacity.pressed },
  badge: {
    position: 'absolute',
    top: spacing.xs,
    right: 0,
    minWidth: BADGE_SIZE,
    minHeight: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    paddingHorizontal: spacing.xs,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: fontSize.xs, fontFamily: fontFamily.bold, color: colors.onAccent },
  chipRow: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  overlay: { flex: 1, backgroundColor: colors.overlay },
  sheet: {
    maxHeight: '80%',
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.md * 2,
    borderTopRightRadius: radius.md * 2,
    paddingTop: spacing.lg,
  },
  sheetContent: { padding: spacing.lg, paddingTop: 0, gap: spacing.lg },
  section: { gap: spacing.sm },
  sectionTitle: { fontSize: fontSize.md, fontFamily: fontFamily.semibold, color: colors.textPrimary },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  sheetActions: { gap: spacing.sm, paddingHorizontal: spacing.lg },
}));
