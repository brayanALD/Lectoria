import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { makeStyles, useTheme } from '../context/ThemeContext';
import { iconSize, minTouchSize, opacity, spacing } from '../theme/spacing';
import { fontFamily, fontSize } from '../theme/typography';
import { MAX_RATING, describeRating, formatRating, getStarFills, nextRating, type StarFill } from '../utils/review';

const FILL_ICONS: Record<StarFill, keyof typeof Ionicons.glyphMap> = {
  full: 'star',
  half: 'star-half',
  empty: 'star-outline',
};

/**
 * Cinco estrellas con la calificación (de media en media). La calificación también se dice con texto («4,5 estrellas de 5»)
 * para el lector de pantalla: el estado no depende solo de cuántas estrellas están rellenas.
 */
export function StarRating({ rating, size = iconSize.md }: { rating: number; size?: number }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.row} accessible accessibilityRole="image" accessibilityLabel={describeRating(rating)}>
      {getStarFills(rating).map((fill, index) => (
        <Ionicons key={index} name={FILL_ICONS[fill]} size={size} color={fill === 'empty' ? colors.outline : colors.primary} />
      ))}
    </View>
  );
}

interface StarRatingInputProps {
  /** Calificación actual (0 = sin calificar). */
  value: number;
  onChange: (value: number) => void;
}

/**
 * Elegir la calificación: cada estrella es un botón de 48 pt. Tocar una la rellena entera; tocar la misma otra vez la
 * deja a la mitad y otra vez la completa (`nextRating`). A la derecha, el valor escrito y, si hay calificación, «Quitar».
 */
export function StarRatingInput({ value, onChange }: StarRatingInputProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const fills = getStarFills(value);

  return (
    <View style={styles.input}>
      <View style={styles.row}>
        {fills.map((fill, index) => {
          const star = index + 1;
          return (
            <Pressable
              key={star}
              accessibilityRole="button"
              accessibilityLabel={`${star} ${star === 1 ? 'estrella' : 'estrellas'}`}
              accessibilityHint="Toca otra vez la misma estrella para media estrella"
              accessibilityState={{ selected: value >= star - 0.5 }}
              onPress={() => onChange(nextRating(value, star))}
              style={({ pressed }) => [styles.star, pressed && styles.pressed]}
            >
              <Ionicons name={FILL_ICONS[fill]} size={iconSize.lg} color={fill === 'empty' ? colors.outline : colors.primary} />
            </Pressable>
          );
        })}
      </View>
      {value > 0 ? (
        <>
          <Text style={styles.value} accessibilityLabel={describeRating(value)}>
            {formatRating(value)}
            <Text style={styles.max}> / {MAX_RATING}</Text>
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Quitar calificación"
            onPress={() => onChange(0)}
            style={({ pressed }) => [styles.clear, pressed && styles.pressed]}
          >
            <Text style={styles.clearText}>Quitar</Text>
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  input: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: spacing.sm },
  star: { width: minTouchSize, height: minTouchSize, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: opacity.pressed },
  value: { fontSize: fontSize.lg, fontFamily: fontFamily.display, color: colors.textPrimary },
  max: { fontSize: fontSize.sm, fontFamily: fontFamily.regular, color: colors.textSecondary },
  clear: { minHeight: minTouchSize, justifyContent: 'center', paddingHorizontal: spacing.sm },
  clearText: { fontSize: fontSize.sm, fontFamily: fontFamily.bold, color: colors.primary },
}));
