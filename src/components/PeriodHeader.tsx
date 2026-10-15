import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { makeStyles, useTheme } from '../context/ThemeContext';
import { iconSize, minTouchSize, opacity } from '../theme/spacing';
import { fontFamily, fontSize } from '../theme/typography';

interface PeriodHeaderProps {
  /** Periodo que se muestra («octubre de 2026», «12 – 18 de octubre de 2026», «2026»). */
  label: string;
  onPrevious: () => void;
  onNext: () => void;
  /** false cuando no hay periodos posteriores (no se puede ir al futuro). */
  canGoNext: boolean;
  previousLabel: string;
  nextLabel: string;
}

/** Encabezado con flechas para recorrer periodos (meses, semanas o años). */
export function PeriodHeader({ label, onPrevious, onNext, canGoNext, previousLabel, nextLabel }: PeriodHeaderProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={previousLabel}
        onPress={onPrevious}
        style={({ pressed }) => [styles.nav, pressed && styles.pressed]}
      >
        <Ionicons name="chevron-back" size={iconSize.md} color={colors.primary} />
      </Pressable>
      <Text style={styles.title} accessibilityRole="header" accessibilityLiveRegion="polite">
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={nextLabel}
        accessibilityState={{ disabled: !canGoNext }}
        disabled={!canGoNext}
        onPress={onNext}
        style={({ pressed }) => [styles.nav, !canGoNext && styles.disabled, pressed && styles.pressed]}
      >
        <Ionicons name="chevron-forward" size={iconSize.md} color={colors.primary} />
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nav: { width: minTouchSize, height: minTouchSize, alignItems: 'center', justifyContent: 'center' },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: fontSize.md,
    fontFamily: fontFamily.semibold,
    color: colors.textPrimary,
    textTransform: 'capitalize',
  },
  pressed: { opacity: opacity.pressed },
  disabled: { opacity: opacity.disabled },
}));
