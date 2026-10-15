import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { useReducedMotion } from '../hooks/useReducedMotion';

import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { fontFamily, fontSize } from '../theme/typography';

interface ReadingProgressProps {
  /** 0–100. */
  percent: number;
  /** Muestra el porcentaje escrito junto a la barra. */
  showLabel?: boolean;
  /** Lo que anuncia el lector de pantalla (por defecto, «Progreso de lectura»). */
  accessibilityLabel?: string;
  /** Valor anunciado en lugar de «N %» (p. ej. «12 de 30 minutos»). */
  valueText?: string;
}

const TRACK_HEIGHT = spacing.sm;
const FILL_MS = 450;

export function ReadingProgress({ percent, showLabel = true, accessibilityLabel = 'Progreso de lectura', valueText }: ReadingProgressProps) {
  const value = Math.min(100, Math.max(0, percent));
  // La barra recorre el camino hasta el nuevo valor (al registrar una lectura se ve avanzar); nace ya en su valor.
  const reduceMotion = useReducedMotion();
  const filled = useRef(new Animated.Value(value)).current;
  useEffect(() => {
    if (reduceMotion) {
      filled.setValue(value);
      return;
    }
    const animation = Animated.timing(filled, {
      toValue: value,
      duration: FILL_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // el ancho no se puede animar con el driver nativo
    });
    animation.start();
    return () => animation.stop();
  }, [filled, reduceMotion, value]);

  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: value, text: valueText ?? `${value} %` }}
    >
      <View style={styles.track}>
        <Animated.View style={[styles.fill, { width: filled.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) }]} />
      </View>
      {showLabel ? <Text style={styles.label}>{value} %</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  track: {
    flex: 1,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: TRACK_HEIGHT / 2, backgroundColor: colors.primary },
  label: { fontSize: fontSize.sm, fontFamily: fontFamily.regular, color: colors.textSecondary, minWidth: spacing.xl + spacing.xs, textAlign: 'right' },
});
