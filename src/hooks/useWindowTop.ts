import { useCallback, useRef, useState } from 'react';
import type { View } from 'react-native';

/**
 * Distancia desde el borde superior de la ventana hasta la parte superior de una vista (encabezado + barra de estado).
 * Se pasa a `KeyboardAvoidingView` como `keyboardVerticalOffset`: sin ella, en pantallas con encabezado calcula mal
 * cuánto espacio dejar para el teclado y tapa los últimos campos.
 * Uso: `<View ref={ref} onLayout={onLayout}>` alrededor del `KeyboardAvoidingView`.
 */
export function useWindowTop() {
  const ref = useRef<View>(null);
  const [top, setTop] = useState(0);
  const onLayout = useCallback(() => {
    ref.current?.measureInWindow((_x, y) => setTop(y));
  }, []);
  return { ref, top, onLayout };
}
