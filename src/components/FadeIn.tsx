import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';

import { useReducedMotion } from '../hooks/useReducedMotion';
import { spacing } from '../theme/spacing';

const DURATION_MS = 360;
const RISE = spacing.md;

interface FadeInProps {
  children: ReactNode;
  /** Retraso en ms antes de empezar: escalonar varios `FadeIn` da una entrada en cascada. */
  delay?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Aparece con un fundido y un leve ascenso al montarse. Es la única «coreografía» de la app (la entrada de Inicio):
 * el movimiento va en un solo momento, no en cada elemento. Con «reducir movimiento» se muestra directamente.
 */
export function FadeIn({ children, delay = 0, style }: FadeInProps) {
  const reduceMotion = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(1);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: DURATION_MS,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [delay, progress, reduceMotion]);

  return (
    <Animated.View
      style={[
        style,
        { opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [RISE, 0] }) }] },
      ]}
    >
      {children}
    </Animated.View>
  );
}
