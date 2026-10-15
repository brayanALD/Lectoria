import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * ¿Pidió la persona «reducir movimiento» en los ajustes del sistema? Toda animación de la app debe consultarlo y, si es
 * así, saltarse el movimiento (mostrar el estado final directamente). Se actualiza si cambia el ajuste con la app abierta.
 */
export function useReducedMotion(): boolean {
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

  return reduceMotion;
}
