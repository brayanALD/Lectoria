import { Platform, useWindowDimensions, type ViewStyle } from 'react-native';

import { layout } from '../theme/spacing';
import { getLayout, type LayoutInfo } from '../utils/layout';

/** La disposición actual (escritorio o móvil) según la plataforma y el ancho de la ventana. Ver `utils/layout`. */
export function useLayout(): LayoutInfo {
  const { width } = useWindowDimensions();
  return getLayout(Platform.OS, width);
}

/**
 * Estilo que centra y acota una columna de lectura (formularios, perfil, listas de una columna) para que en una ventana
 * ancha no se estire de lado a lado. Se añade al `contentContainerStyle` del `ScrollView` o la `FlatList`. En el móvil no
 * existe (`undefined`): la pantalla ocupa todo el ancho, como siempre.
 */
export const readingColumn: ViewStyle | undefined =
  Platform.OS === 'web' ? { width: '100%', maxWidth: layout.formMaxWidth, alignSelf: 'center' } : undefined;

/** Igual que `readingColumn`, para el formulario de acceso (más estrecho). */
export const authColumn: ViewStyle | undefined =
  Platform.OS === 'web' ? { width: '100%', maxWidth: layout.authFormMaxWidth, alignSelf: 'center' } : undefined;
