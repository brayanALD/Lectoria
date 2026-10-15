import type { ColorTokens } from '../theme/colors';
import { fontFamily, fontSize } from '../theme/typography';

/**
 * Apariencia común de los encabezados (pestañas y pantallas del stack): sin línea ni sombra, sobre el mismo fondo que
 * la pantalla, con el título más presente y las acciones (volver, «+», configuración) en el color principal.
 */
export const getHeaderOptions = (colors: ColorTokens) =>
  ({
    headerShadowVisible: false,
    headerStyle: { backgroundColor: colors.background },
    headerTintColor: colors.primary,
    headerTitleStyle: { color: colors.textPrimary, fontSize: fontSize.lg, fontFamily: fontFamily.display },
  }) as const;

/** Apariencia de la barra de pestañas: fondo del lienzo, filo sutil y etiquetas pequeñas con peso. */
export const getTabBarOptions = (colors: ColorTokens) =>
  ({
    tabBarActiveTintColor: colors.primary,
    tabBarInactiveTintColor: colors.textSecondary,
    tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border },
    tabBarLabelStyle: { fontSize: fontSize.xs, fontFamily: fontFamily.semibold },
  }) as const;
