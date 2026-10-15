import type { ReactNode, Ref } from 'react';
import { Image, KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { fontSize, fontWeight } from '../theme/typography';

const logo = require('../../assets/logo.png');
const LOGO_SIZE = spacing.xl * 2 + spacing.sm;

interface AuthLayoutProps {
  children: ReactNode;
  /** Permite a la pantalla desplazar el contenido (p. ej. al enfocar el último campo). */
  scrollRef?: Ref<ScrollView>;
}

// Contenedor común de Login y Registro: marca, área segura, teclado y desplazamiento.
// Sin títulos ni subtítulos: el logo y el botón principal ya indican qué se está haciendo.
export function AuthLayout({ children, scrollRef }: AuthLayoutProps) {
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
        <View style={styles.brandRow}>
          <Image source={logo} style={styles.logo} accessible={false} />
          <Text style={styles.brand} accessibilityRole="header">
            Lectoria
          </Text>
        </View>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, paddingHorizontal: spacing.lg, gap: spacing.md },
  brandRow: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  logo: { width: LOGO_SIZE, height: LOGO_SIZE },
  brand: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.primary },
});
