import type { ReactNode, Ref } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { fontSize, fontWeight } from '../theme/typography';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  /** Permite a la pantalla desplazar el contenido (p. ej. al enfocar el último campo). */
  scrollRef?: Ref<ScrollView>;
}

// Contenedor común de Login y Registro: área segura, teclado y desplazamiento.
export function AuthLayout({ title, subtitle, children, scrollRef }: AuthLayoutProps) {
  const insets = useSafeAreaInsets();

  // behavior="padding" en ambas plataformas: con edge-to-edge, Android ya no redimensiona la ventana
  // por sí solo, y el teclado taparía los últimos campos.
  return (
    <KeyboardAvoidingView style={styles.flex} behavior="padding">
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl * 2 },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Text style={styles.brand}>Lectoria</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, paddingHorizontal: spacing.lg, gap: spacing.md },
  brand: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.primary },
  title: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.textPrimary },
  subtitle: { fontSize: fontSize.md, color: colors.textSecondary, marginBottom: spacing.sm },
});
