import { useRef } from 'react';
import { Animated, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { useReducedMotion } from '../hooks/useReducedMotion';
import { pressScale } from '../theme/spacing';

// Resorte corto y sin rebote: la pulsación se «hunde» y vuelve al soltar.
const SPRING_SPEED = 40;
const SPRING_BOUNCINESS = 0;

interface PressableScaleProps extends PressableProps {
  /**
   * Estilo del contenedor animado: aquí va lo que posiciona el elemento en su fila o columna (p. ej. `flex: 1`).
   * `style` (el del propio botón o card) se aplica dentro, así la forma, el fondo y las sombras escalan juntos.
   */
  containerStyle?: StyleProp<ViewStyle>;
}

/**
 * `Pressable` que se encoge un poco al pulsarlo (con resorte, con el driver nativo). Con «reducir movimiento» activado
 * no hay animación: se queda solo el estado presionado del propio componente.
 */
export function PressableScale({ containerStyle, onPressIn, onPressOut, ...pressableProps }: PressableScaleProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const reduceMotion = useReducedMotion();

  const animateTo = (toValue: number) => {
    if (reduceMotion) return;
    Animated.spring(scale, { toValue, speed: SPRING_SPEED, bounciness: SPRING_BOUNCINESS, useNativeDriver: true }).start();
  };

  return (
    <Animated.View style={[containerStyle, { transform: [{ scale }] }]}>
      <Pressable
        {...pressableProps}
        onPressIn={(event) => {
          animateTo(pressScale);
          onPressIn?.(event);
        }}
        onPressOut={(event) => {
          animateTo(1);
          onPressOut?.(event);
        }}
      />
    </Animated.View>
  );
}
