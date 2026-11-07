import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet, Text, View, type PressableStateCallbackType } from 'react-native';

import { makeStyles, useTheme } from '../context/ThemeContext';
import { iconSize, layout, minTouchSize, opacity, radius, spacing } from '../theme/spacing';
import { fontFamily, fontSize } from '../theme/typography';
import { Button } from './Button';

const logo = require('../../assets/logo.png');
const LOGO_SIZE = spacing.xl + spacing.sm;

type IconName = keyof typeof Ionicons.glyphMap;

export interface SidebarItem {
  key: string;
  label: string;
  /** Icono de contorno; el relleno (sin `-outline`) se usa para el elemento activo. */
  icon: IconName;
}

interface SidebarProps {
  items: SidebarItem[];
  /** La clave del elemento que está a la vista. */
  activeKey: string | undefined;
  onSelect: (key: string) => void;
  /** La acción principal de la app, siempre a mano: registrar una lectura. */
  onRegister: () => void;
  onOpenSettings: () => void;
}

type HoverState = PressableStateCallbackType & { hovered?: boolean };

/**
 * Navegación de la web de escritorio: la marca, la acción principal («Registrar lectura»), los cinco destinos y la
 * configuración. Sustituye a la barra de pestañas inferior. Solo pinta: la lógica de navegación vive en `WebShell`.
 */
export function Sidebar({ items, activeKey, onSelect, onRegister, onOpenSettings }: SidebarProps) {
  const styles = useStyles();
  const { colors } = useTheme();

  return (
    <View style={styles.sidebar} role="navigation" accessibilityLabel="Navegación principal">
      <View style={styles.brand}>
        {/* El logo solo se ve bien sobre claro: va sobre una losa clara también en el tema oscuro. */}
        <View style={styles.logoTile}>
          <Image source={logo} style={styles.logo} accessible={false} />
        </View>
        <Text style={styles.brandName} accessibilityRole="header">
          Lectoria
        </Text>
      </View>

      <Button
        title="Registrar lectura"
        onPress={onRegister}
        icon={<Ionicons name="add" size={iconSize.md} color={colors.onPrimary} accessible={false} />}
      />

      <View style={styles.items}>
        {items.map((item) => {
          const active = item.key === activeKey;
          const color = active ? colors.onPrimary : colors.textPrimary;
          return (
            <Pressable
              key={item.key}
              accessibilityRole="link"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: active }}
              aria-current={active ? 'page' : undefined}
              onPress={() => onSelect(item.key)}
              style={(state: HoverState) => [
                styles.item,
                active ? styles.itemActive : state.hovered && styles.itemHover,
                state.pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name={(active ? item.icon.replace('-outline', '') : item.icon) as IconName}
                size={iconSize.md}
                color={color}
                accessible={false}
              />
              <Text style={[styles.itemLabel, { color }]} numberOfLines={1}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.spacer} />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Configuración"
        onPress={onOpenSettings}
        style={(state: HoverState) => [styles.item, state.hovered && styles.itemHover, state.pressed && styles.pressed]}
      >
        <Ionicons name="settings-outline" size={iconSize.md} color={colors.textPrimary} accessible={false} />
        <Text style={[styles.itemLabel, { color: colors.textPrimary }]}>Configuración</Text>
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((colors) =>
  StyleSheet.create({
    // Superficie tonal: separa la navegación del contenido con color, no con una línea.
    sidebar: {
      width: layout.sidebarWidth,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.md,
      gap: spacing.md,
      backgroundColor: colors.surfaceTint,
    },
    brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm, paddingBottom: spacing.sm },
    logoTile: { padding: spacing.xs, borderRadius: radius.md, backgroundColor: colors.brandSurface },
    logo: { width: LOGO_SIZE, height: LOGO_SIZE },
    brandName: { fontSize: fontSize.xl, fontFamily: fontFamily.displayBold, color: colors.primary },
    items: { gap: spacing.xs, marginTop: spacing.sm },
    item: {
      minHeight: minTouchSize,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.md,
      borderRadius: radius.lg,
    },
    itemActive: { backgroundColor: colors.primary },
    itemHover: { backgroundColor: colors.border },
    itemLabel: { flex: 1, fontSize: fontSize.md, fontFamily: fontFamily.semibold },
    pressed: { opacity: opacity.pressed },
    spacer: { flex: 1 },
  }),
);
