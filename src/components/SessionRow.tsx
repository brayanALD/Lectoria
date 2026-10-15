import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { makeStyles, useTheme } from '../context/ThemeContext';
import { iconSize, minTouchSize, opacity, spacing } from '../theme/spacing';
import { fontFamily, fontSize } from '../theme/typography';

interface SessionRowProps {
  /** Lo que identifica la sesión en esa pantalla: el libro (Calendario, Inicio) o el día (detalle del libro). */
  title: string;
  /** Duración, páginas y, si hace falta, el día. */
  detail: string;
  notes?: string;
  /** Si se indica, tocar la fila abre algo (p. ej. el libro de la sesión). */
  onPress?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

/** Una sesión de lectura en una lista. Es la misma fila en Inicio, el Calendario y el detalle del libro. */
export function SessionRow({ title, detail, notes, onPress, onEdit, onDelete }: SessionRowProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const text = (
    <>
      <Text style={styles.title} numberOfLines={2}>
        {title}
      </Text>
      <Text style={styles.detail}>{detail}</Text>
      {notes ? <Text style={styles.notes}>{notes}</Text> : null}
    </>
  );

  return (
    <View style={styles.item}>
      {onPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${title}. ${detail}`}
          onPress={onPress}
          style={({ pressed }) => [styles.main, pressed && styles.pressed]}
        >
          <View style={styles.text}>{text}</View>
          <Ionicons name="chevron-forward" size={iconSize.md} color={colors.textSecondary} accessible={false} />
        </Pressable>
      ) : (
        <View style={styles.text}>{text}</View>
      )}
      {onEdit ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Editar la sesión de ${title}`}
          onPress={onEdit}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <Ionicons name="pencil-outline" size={iconSize.md} color={colors.primary} />
        </Pressable>
      ) : null}
      {onDelete ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Eliminar la sesión de ${title}`}
          onPress={onDelete}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <Ionicons name="trash-outline" size={iconSize.md} color={colors.error} />
        </Pressable>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  text: { flex: 1, gap: spacing.xs, justifyContent: 'center', minHeight: minTouchSize },
  title: { fontSize: fontSize.md, fontFamily: fontFamily.semibold, color: colors.textPrimary },
  detail: { fontSize: fontSize.sm, fontFamily: fontFamily.regular, color: colors.textSecondary },
  notes: { fontSize: fontSize.sm, fontFamily: fontFamily.regular, color: colors.textPrimary },
  action: { width: minTouchSize, height: minTouchSize, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: opacity.pressed },
}));
