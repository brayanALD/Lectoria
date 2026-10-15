import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../theme/colors';
import { elevation } from '../theme/elevation';
import { radius, spacing } from '../theme/spacing';

// Asa decorativa de la hoja (indica que es una hoja inferior que se puede cerrar).
const GRABBER_WIDTH = spacing.xl + spacing.sm;
const GRABBER_HEIGHT = spacing.xs;

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
}

// Hoja inferior modal: se cierra tocando fuera, con el botón de atrás de Android o desde su contenido.
// accessibilityViewIsModal evita que el lector de pantalla salga hacia el contenido que queda detrás.
// KeyboardAvoidingView la levanta cuando el contenido tiene un campo de texto (el Modal es una ventana propia).
export function Sheet({ visible, onClose, children }: SheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.root} behavior="padding">
        <Pressable style={styles.overlay} onPress={onClose} accessibilityRole="button" accessibilityLabel="Cerrar" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]} accessibilityViewIsModal>
          <View style={styles.grabber} accessible={false} importantForAccessibility="no-hide-descendants" />
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  overlay: { flex: 1, backgroundColor: colors.overlay },
  sheet: {
    maxHeight: '85%',
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.md * 2,
    borderTopRightRadius: radius.md * 2,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    ...elevation.high,
  },
  grabber: {
    alignSelf: 'center',
    width: GRABBER_WIDTH,
    height: GRABBER_HEIGHT,
    borderRadius: radius.pill,
    backgroundColor: colors.outline,
  },
});
