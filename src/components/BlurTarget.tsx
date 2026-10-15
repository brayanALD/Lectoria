import { createContext, useContext, useRef, type ReactNode, type RefObject } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '../context/ThemeContext';

// `expo-blur` es un módulo nativo: si la app instalada se compiló sin él, importarlo falla. Se carga con respaldo para
// que, en ese caso, el panel siga funcionando con una capa oscura sin desenfoque (igual que la librería de Google).
type BlurModule = typeof import('expo-blur');
let blur: BlurModule | undefined;
try {
  blur = require('expo-blur') as BlurModule;
} catch {
  blur = undefined;
}

// Intensidad del desenfoque (1–100).
const BLUR_INTENSITY = 40;

const TargetContext = createContext<RefObject<View | null> | null>(null);

interface BlurTargetProps {
  children: ReactNode;
  /** Mientras es `true`, el contenido se oculta a los lectores de pantalla (hay una hoja modal encima). */
  inert?: boolean;
}

/**
 * Envuelve el contenido que `BlurBackdrop` desenfoca. En Android el desenfoque solo puede difuminar lo que está dentro
 * de un `BlurTargetView` de la misma ventana, así que toda la app va dentro y el panel se dibuja como capa superpuesta
 * (no como `Modal`, que es otra ventana).
 */
export function BlurTarget({ children, inert = false }: BlurTargetProps) {
  const ref = useRef<View>(null);
  const Target = blur?.BlurTargetView ?? View;
  return (
    <TargetContext.Provider value={ref}>
      <Target
        ref={ref}
        style={styles.fill}
        importantForAccessibility={inert ? 'no-hide-descendants' : 'auto'}
        accessibilityElementsHidden={inert}
      >
        {children}
      </Target>
    </TargetContext.Provider>
  );
}

/** La capa que va detrás de un panel: contenido desenfocado y oscurecido. Sin `expo-blur`, solo oscurecido. */
export function BlurBackdrop() {
  const { colors, isDark } = useTheme();
  const target = useContext(TargetContext);
  const BlurView = blur?.BlurView;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {BlurView ? (
        <BlurView
          style={StyleSheet.absoluteFill}
          intensity={BLUR_INTENSITY}
          tint={isDark ? 'dark' : 'light'}
          blurTarget={target ?? undefined}
          blurMethod="dimezisBlurViewSdk31Plus"
        />
      ) : null}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
