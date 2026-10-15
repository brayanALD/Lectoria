import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { iconSize, minTouchSize, radius, spacing } from '../theme/spacing';
import { fontFamily, fontSize } from '../theme/typography';
import { Button } from './Button';

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  /** Acción opcional (p. ej. «Reintentar» o «Añadir libro»). */
  action?: { label: string; onPress: () => void };
}

// Estado vacío o de error de una lista o pantalla.
export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.badge}>
        <Ionicons name={icon} size={iconSize.lg} color={colors.primary} accessible={false} />
      </View>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {action ? (
        <View style={styles.action}>
          <Button title={action.label} onPress={action.onPress} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
    backgroundColor: colors.background,
  },
  badge: {
    width: minTouchSize + spacing.lg,
    height: minTouchSize + spacing.lg,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    backgroundColor: colors.accentSoft,
  },
  title: { fontSize: fontSize.lg, fontFamily: fontFamily.display, color: colors.textPrimary, textAlign: 'center' },
  description: { fontSize: fontSize.md, fontFamily: fontFamily.regular, color: colors.textSecondary, textAlign: 'center' },
  action: { alignSelf: 'stretch', marginTop: spacing.md },
});
