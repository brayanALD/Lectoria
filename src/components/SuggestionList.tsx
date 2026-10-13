import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { minTouchSize, opacity, radius, spacing } from '../theme/spacing';
import { fontSize } from '../theme/typography';

interface SuggestionListProps {
  suggestions: readonly string[];
  onSelect: (suggestion: string) => void;
  /** Lo que anuncia el lector de pantalla al enfocar una sugerencia (p. ej. «Usar esta saga»). */
  accessibilityHint: string;
}

// Opciones bajo un campo de texto mientras se escribe. Va dentro del flujo del formulario (no flota encima), así
// que nunca tapa otros campos ni depende de la posición del teclado.
export function SuggestionList({ suggestions, onSelect, accessibilityHint }: SuggestionListProps) {
  return (
    <View style={styles.list}>
      {suggestions.map((suggestion) => (
        <Pressable
          key={suggestion}
          accessibilityRole="button"
          accessibilityLabel={suggestion}
          accessibilityHint={accessibilityHint}
          onPress={() => onSelect(suggestion)}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <Text style={styles.text} numberOfLines={1}>
            {suggestion}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.xs },
  row: {
    minHeight: minTouchSize,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  pressed: { opacity: opacity.pressed },
  text: { fontSize: fontSize.md, color: colors.textPrimary },
});
