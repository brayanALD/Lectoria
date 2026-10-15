import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';

import { makeStyles } from '../context/ThemeContext';
import { opacity, radius } from '../theme/spacing';

const PULSE_MS = 800;

interface SkeletonProps {
  width?: DimensionValue;
  height: number;
  /** Para marcadores con forma de portada, p. ej. `aspectRatio`. */
  style?: StyleProp<ViewStyle>;
}

/** Marcador de posición: una silueta lisa con el tamaño del contenido que va a llegar. */
export function Skeleton({ width = '100%', height, style }: SkeletonProps) {
  const styles = useStyles();
  return <View style={[styles.bone, { width, height }, style]} />;
}

interface SkeletonPulseProps {
  /** Lo que anuncia el lector de pantalla mientras carga (p. ej. «Cargando biblioteca»). */
  label: string;
  children: ReactNode;
}

/**
 * Agrupa varios `Skeleton` y los hace latir a la vez con una sola animación.
 * Con «reducir movimiento» activado en el sistema no hay animación. Para el lector de pantalla es un único
 * elemento «cargando»: las siluetas no se leen una a una.
 */
export function SkeletonPulse({ label, children }: SkeletonPulseProps) {
  const styles = useStyles();
  const pulse = useRef(new Animated.Value(1)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => active && setReduceMotion(enabled));
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: opacity.skeleton, duration: PULSE_MS, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: PULSE_MS, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduceMotion]);

  return (
    <Animated.View
      style={[styles.pulse, { opacity: pulse }]}
      accessible
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
      accessibilityLiveRegion="polite"
    >
      <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={styles.pulse}>
        {children}
      </View>
    </Animated.View>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  bone: { backgroundColor: colors.border, borderRadius: radius.sm },
  pulse: { flex: 1, backgroundColor: colors.background },
}));
