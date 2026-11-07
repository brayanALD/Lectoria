import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { makeStyles } from '../context/ThemeContext';
import { useLayout } from '../hooks/useLayout';
import { elevation } from '../theme/elevation';
import { layout, radius, spacing } from '../theme/spacing';

// Asa decorativa de la hoja (indica que es una hoja inferior que se puede cerrar).
const GRABBER_WIDTH = spacing.xl + spacing.sm;
const GRABBER_HEIGHT = spacing.xs;

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
}

// Hoja inferior modal: se cierra tocando fuera, con el botón de atrás de Android (o Escape en la web) o desde su contenido.
// En la web de escritorio se muestra como un diálogo centrado, con el mismo contenido.
// accessibilityViewIsModal evita que el lector de pantalla salga hacia el contenido que queda detrás.
// KeyboardAvoidingView la levanta cuando el contenido tiene un campo de texto (el Modal es una ventana propia).
export function Sheet({ visible, onClose, children }: SheetProps) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { isWide } = useLayout();

  return (
    <Modal
      visible={visible}
      transparent
      animationType={isWide ? 'fade' : 'slide'}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView style={[styles.root, isWide && styles.rootCentered]} behavior="padding">
        <Pressable
          style={isWide ? styles.overlayBehind : styles.overlay}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
        />
        <View
          style={[styles.sheet, isWide ? styles.dialog : { paddingBottom: insets.bottom + spacing.md }]}
          accessibilityViewIsModal
        >
          {isWide ? null : <View style={styles.grabber} accessible={false} importantForAccessibility="no-hide-descendants" />}
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  root: { flex: 1 },
  rootCentered: { alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  overlay: { flex: 1, backgroundColor: colors.overlay },
  // Como diálogo, el fondo atenuado cubre toda la ventana y la hoja flota encima, centrada.
  overlayBehind: { ...StyleSheet.absoluteFill, backgroundColor: colors.overlay },
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
  dialog: {
    width: '100%',
    maxWidth: layout.dialogMaxWidth,
    borderRadius: radius.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    ...elevation.dialog,
  },
  grabber: {
    alignSelf: 'center',
    width: GRABBER_WIDTH,
    height: GRABBER_HEIGHT,
    borderRadius: radius.pill,
    backgroundColor: colors.outline,
  },
}));
