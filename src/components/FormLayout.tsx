import type { ReactNode } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';

import { makeStyles } from '../context/ThemeContext';
import { useWindowTop } from '../hooks/useWindowTop';
import { spacing } from '../theme/spacing';

/**
 * Contenedor de un formulario de una pantalla del stack: desplazable, con el teclado sin tapar los últimos campos
 * (`KeyboardAvoidingView` con el desplazamiento del encabezado) y los campos separados por el espacio estándar.
 */
export function FormLayout({ children }: { children: ReactNode }) {
  const styles = useStyles();
  const { ref, top, onLayout } = useWindowTop();

  return (
    <View ref={ref} onLayout={onLayout} style={styles.flex}>
      <KeyboardAvoidingView style={styles.flex} behavior="padding" keyboardVerticalOffset={top}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl * 3 },
}));
