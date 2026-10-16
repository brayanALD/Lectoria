import { Ionicons } from '@expo/vector-icons';
import { useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Acquisition } from '../types/book';
import { makeStyles, useTheme } from '../context/ThemeContext';
import { iconSize, minTouchSize, opacity, radius, spacing } from '../theme/spacing';
import { fontFamily, fontSize, maxFontScale } from '../theme/typography';
import { READING_STATUSES, READING_STATUS_LABELS, formatBookCount, formatFilteredBookCount } from '../utils/book';
import {
  clearFilters,
  countActiveFilters,
  getActiveFilters,
  hasActiveFilters,
  removeFilter,
  type BookFilterOptions,
  type BookFilterState,
} from '../utils/bookFilters';
import { Button } from './Button';
import { Chip } from './Chip';

interface BookFiltersProps {
  filters: BookFilterState;
  onChange: (filters: BookFilterState) => void;
  /** Valores disponibles para género, autor y saga, calculados a partir de la lista que se ve. */
  options: BookFilterOptions;
  /** Cuántos libros tiene cada lista: son los números de las pestañas. */
  counts: Record<Acquisition, number>;
  /** Cuántos libros quedan con la búsqueda y los filtros actuales (resumen y pie de la hoja). */
  resultCount: number;
  /** Lo que va a la derecha de las pestañas (el cambio de vista de la pantalla). */
  accessory?: ReactNode;
}

type SheetFilter = 'status' | 'genre' | 'author' | 'series';

interface SheetSection {
  key: SheetFilter;
  title: string;
  selected: string | null;
  options: { value: string; label: string }[];
}

const SHEET_SECTIONS: { key: Exclude<SheetFilter, 'status'>; title: string; options: keyof BookFilterOptions }[] = [
  { key: 'genre', title: 'Género', options: 'genres' },
  { key: 'author', title: 'Autor', options: 'authors' },
  { key: 'series', title: 'Saga', options: 'series' },
];

// Qué lista se ve: los libros propios o los deseos (siempre hay una elegida).
const ACQUISITIONS: { value: Acquisition; label: string }[] = [
  { value: 'owned', label: 'Mis libros' },
  { value: 'wishlist', label: 'Deseos' },
];

const BADGE_SIZE = spacing.md + spacing.xs;
// Geometría local: el subrayado de la pestaña elegida y la altura visual de los chips del resumen (su zona táctil es de 48).
const TAB_INDICATOR = 2;
const SUMMARY_CHIP_HEIGHT = spacing.xl;
const SUMMARY_CLOSE_SIZE = iconSize.sm - spacing.xs;

/**
 * Cabecera de la Biblioteca: una cápsula con la búsqueda y el botón de filtros, las pestañas «Mis libros / Deseos» y,
 * solo si hay búsqueda o filtros, un resumen con el recuento y un chip para quitar cada filtro. El estado de lectura,
 * el género, el autor y la saga se eligen en una hoja inferior.
 */
export function BookFilters({ filters, onChange, options, counts, resultCount, accessory }: BookFiltersProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [sheetOpen, setSheetOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const activeFilters = getActiveFilters(filters);
  const activeCount = countActiveFilters(filters);

  const set = (changes: Partial<BookFilterState>) => onChange({ ...filters, ...changes });

  // Solo se muestran los criterios con opciones (o con un valor ya elegido que aún se pueda quitar). El estado de
  // lectura solo existe en «Mis libros»: un deseo aún no se ha empezado.
  const sections: SheetSection[] = [];
  if (filters.acquisition === 'owned') {
    sections.push({
      key: 'status',
      title: 'Estado',
      selected: filters.status,
      options: READING_STATUSES.map((status) => ({ value: status, label: READING_STATUS_LABELS[status] })),
    });
  }
  for (const section of SHEET_SECTIONS) {
    const selected = filters[section.key];
    const values = options[section.options];
    const shown = selected && !values.includes(selected) ? [selected, ...values] : values;
    if (shown.length > 0) {
      sections.push({ key: section.key, title: section.title, selected, options: shown.map((value) => ({ value, label: value })) });
    }
  }

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
          <View style={styles.divider} accessible={false} />
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
      </View>

      <View style={styles.tabRow}>
        <View style={styles.tabs} accessibilityRole="tablist">
          {ACQUISITIONS.map((option) => {
            const selected = filters.acquisition === option.value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="tab"
                accessibilityLabel={`${option.label}, ${formatBookCount(counts[option.value])}`}
                accessibilityState={{ selected }}
                // El estado de lectura no aplica a los deseos (aún no se han empezado): al cambiar de lista se quita.
                onPress={() => set({ acquisition: option.value, status: null })}
                style={({ pressed }) => [styles.tab, selected && styles.tabSelected, pressed && styles.pressed]}
              >
                <Text style={[styles.tabLabel, selected && styles.tabLabelSelected]} maxFontSizeMultiplier={maxFontScale}>
                  {option.label}
                </Text>
                <Text style={styles.tabCount} maxFontSizeMultiplier={maxFontScale}>
                  {counts[option.value]}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {accessory}
      </View>

      {hasActiveFilters(filters) ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.summary}
        >
          <Text style={styles.summaryCount} accessibilityLiveRegion="polite">
            {formatFilteredBookCount(resultCount, counts[filters.acquisition])}
          </Text>
          {activeFilters.map((filter) => (
            <Pressable
              key={filter.key}
              accessibilityRole="button"
              accessibilityLabel={`Quitar filtro ${filter.label}`}
              onPress={() => onChange(removeFilter(filters, filter.key))}
              style={styles.summaryTouch}
            >
              <View style={styles.summaryChip}>
                <Text style={styles.summaryChipText} numberOfLines={1} maxFontSizeMultiplier={maxFontScale}>
                  {filter.label}
                </Text>
                <Ionicons name="close" size={SUMMARY_CLOSE_SIZE} color={colors.onPrimary} accessible={false} />
              </View>
            </Pressable>
          ))}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Limpiar búsqueda y filtros"
            onPress={() => onChange(clearFilters(filters))}
            style={styles.summaryTouch}
          >
            <Text style={styles.clearText} maxFontSizeMultiplier={maxFontScale}>
              Limpiar
            </Text>
          </Pressable>
        </ScrollView>
      ) : null}

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
                  {section.options.map((option) => (
                    <Chip
                      key={option.value}
                      label={option.label}
                      selected={section.selected === option.value}
                      onPress={() =>
                        set({ [section.key]: section.selected === option.value ? null : option.value } as Partial<BookFilterState>)
                      }
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
              onPress={() => set({ status: null, genre: null, author: null, series: null })}
            />
            <Button title={`Ver ${formatBookCount(resultCount)}`} onPress={() => setSheetOpen(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  container: { gap: spacing.xs, paddingTop: spacing.sm },
  searchRow: { paddingHorizontal: spacing.lg },
  // Una sola cápsula con el borde de los controles: el buscador y, dentro, el botón de filtros.
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: minTouchSize,
    paddingLeft: spacing.md,
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  searchInput: { flex: 1, fontSize: fontSize.md, fontFamily: fontFamily.regular, color: colors.textPrimary, paddingVertical: 0 },
  divider: { width: 1, height: spacing.lg, backgroundColor: colors.border },
  filterButton: { width: minTouchSize, height: minTouchSize, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: opacity.pressed },
  badge: {
    position: 'absolute',
    top: spacing.sm - spacing.xs / 2,
    right: spacing.xs,
    minWidth: BADGE_SIZE,
    minHeight: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    paddingHorizontal: spacing.xs,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: fontSize.xs, fontFamily: fontFamily.bold, color: colors.onAccent },
  // Pestañas de texto con subrayado: a la derecha, lo que añada la pantalla (el cambio de vista).
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm + spacing.xs,
  },
  tabs: { flexDirection: 'row', gap: spacing.lg },
  tab: {
    minHeight: minTouchSize,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + spacing.xs / 2,
    borderBottomWidth: TAB_INDICATOR,
    borderBottomColor: 'transparent',
  },
  tabSelected: { borderBottomColor: colors.primary },
  tabLabel: { fontSize: fontSize.md, fontFamily: fontFamily.semibold, color: colors.textSecondary },
  tabLabelSelected: { color: colors.textPrimary },
  tabCount: { fontSize: fontSize.sm, fontFamily: fontFamily.semibold, color: colors.textSecondary },
  // Resumen de búsqueda y filtros: solo existe mientras hay alguno activo.
  summary: { alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg },
  summaryCount: { fontSize: fontSize.sm, fontFamily: fontFamily.semibold, color: colors.textSecondary },
  // La zona táctil es de 48 pt aunque el chip se vea más bajo.
  summaryTouch: { minHeight: minTouchSize, justifyContent: 'center' },
  summaryChip: {
    height: SUMMARY_CHIP_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingLeft: spacing.sm + spacing.xs,
    paddingRight: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  summaryChipText: { fontSize: fontSize.sm, fontFamily: fontFamily.semibold, color: colors.onPrimary },
  clearText: { fontSize: fontSize.sm, fontFamily: fontFamily.bold, color: colors.primary, paddingHorizontal: spacing.xs },
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
