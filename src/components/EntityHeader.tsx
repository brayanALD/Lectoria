import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { makeStyles } from '../context/ThemeContext';
import { spacing } from '../theme/spacing';
import { fontFamily, fontSize } from '../theme/typography';

interface EntityHeaderProps {
  title: string;
  /** Líneas de resumen bajo el nombre (cuántos libros, qué falta…). */
  lines?: (string | undefined)[];
  /** Lo que va debajo (una barra de avance, acciones…). */
  children?: ReactNode;
}

/** La cabecera de las pantallas de detalle de un autor, una saga o una colección: el nombre y su resumen. */
export function EntityHeader({ title, lines = [], children }: EntityHeaderProps) {
  const styles = useStyles();
  return (
    <View style={styles.header}>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {lines.map((line) =>
        line ? (
          <Text key={line} style={styles.line}>
            {line}
          </Text>
        ) : null,
      )}
      {children}
    </View>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  header: { gap: spacing.sm, paddingBottom: spacing.md },
  title: { fontSize: fontSize.xl, fontFamily: fontFamily.displayBold, color: colors.textPrimary },
  line: { fontSize: fontSize.md, fontFamily: fontFamily.regular, color: colors.textSecondary },
}));
