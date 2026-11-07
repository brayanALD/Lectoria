import type { ReactNode, Ref } from 'react';
import { Image, KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { makeStyles } from '../context/ThemeContext';
import { authColumn, useLayout } from '../hooks/useLayout';
import { radius, spacing } from '../theme/spacing';
import { fontFamily, fontSize } from '../theme/typography';
import { BrandPanel } from './BrandPanel';

const logo = require('../../assets/logo.png');
const LOGO_SIZE = spacing.xl * 2 + spacing.sm;

interface AuthLayoutProps {
  children: ReactNode;
  /** Permite a la pantalla desplazar el contenido (p. ej. al enfocar el último campo). */
  scrollRef?: Ref<ScrollView>;
}

// Contenedor común de Login y Registro: marca, área segura, teclado y desplazamiento.
// Sin títulos ni subtítulos: el logo y el botón principal ya indican qué se está haciendo.
// En la web de escritorio la pantalla se parte en dos: el panel de marca a la izquierda y el formulario a la derecha.
export function AuthLayout({ children, scrollRef }: AuthLayoutProps) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { isWide } = useLayout();

  // behavior="padding" en ambas plataformas: con edge-to-edge, Android ya no redimensiona la ventana
  // por sí solo, y el teclado taparía los últimos campos.
  const form = (
    <KeyboardAvoidingView style={styles.flex} behavior="padding">
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.content,
          isWide && styles.contentCentered,
          { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl * 2 },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* El formulario se acota en la web para que los campos no se estiren de lado a lado. */}
        <View style={[styles.column, authColumn]}>
          {/* En escritorio la marca ya está en el panel. */}
          {isWide ? null : (
            <View style={styles.brandRow}>
              <View style={styles.logoTile}>
                <Image source={logo} style={styles.logo} accessible={false} />
              </View>
              <Text style={styles.brand} accessibilityRole="header">
                Lectoria
              </Text>
            </View>
          )}
          {children}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  if (!isWide) return form;

  return (
    <View style={styles.split}>
      <BrandPanel />
      <View style={styles.pane}>{form}</View>
    </View>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  split: { flex: 1, flexDirection: 'row', backgroundColor: colors.background },
  // Una columna con el mismo reparto que el panel de marca: el formulario ocupa su mitad, centrado.
  pane: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: spacing.lg },
  contentCentered: { justifyContent: 'center' },
  // El espaciado entre campos vive en la columna (y no en el contenedor de desplazamiento) para poder acotar su ancho.
  column: { gap: spacing.md },
  brandRow: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  // El logo solo se ve bien sobre claro: en el tema oscuro va sobre una losa clara.
  logoTile: { padding: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.brandSurface },
  logo: { width: LOGO_SIZE, height: LOGO_SIZE },
  brand: { fontSize: fontSize.xl, fontFamily: fontFamily.displayBold, color: colors.primary },
}));
