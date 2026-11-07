import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useLayout } from '../hooks/useLayout';
import { spacing } from '../theme/spacing';

interface SplitLayoutProps {
  /** La columna principal (la más ancha). */
  main: ReactNode;
  /** La columna secundaria: el detalle o lo complementario. */
  aside?: ReactNode;
  /** Separación vertical entre los bloques de cada columna. */
  gap?: number;
}

/**
 * Reparte una pantalla en dos columnas (principal y secundaria) cuando hay sitio, es decir, en la web de escritorio. En
 * cualquier otro caso (móvil, ventana estrecha) no añade nada: los bloques se apilan, principal primero, dentro del
 * contenedor de la pantalla, así que su espaciado y orden son los de siempre.
 */
export function SplitLayout({ main, aside, gap = spacing.lg }: SplitLayoutProps) {
  const { isWide } = useLayout();

  if (!isWide) {
    return (
      <>
        {main}
        {aside}
      </>
    );
  }

  return (
    <View style={styles.row}>
      <View style={[styles.main, { gap }]}>{main}</View>
      {aside ? <View style={[styles.aside, { gap }]}>{aside}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xl },
  // `flexBasis: 0` con `flex` reparte el ancho 3:2 sin que el contenido de una columna empuje a la otra.
  main: { flex: 3, flexBasis: 0, minWidth: 0 },
  aside: { flex: 2, flexBasis: 0, minWidth: 0 },
});
