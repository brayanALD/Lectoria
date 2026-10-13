import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useRef, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '../../../components/EmptyState';
import type { AppStackParamList } from '../../../navigation/types';
import { colors } from '../../../theme/colors';
import { radius, spacing } from '../../../theme/spacing';
import { fontSize, fontWeight } from '../../../theme/typography';
import { getScanFeedback, parseIsbn } from '../../../utils/isbn';

type Props = NativeStackScreenProps<AppStackParamList, 'ScanBook'>;

// Proporción del recuadro guía: los códigos de barras de los libros son más anchos que altos.
const GUIDE_WIDTH = '80%';
const GUIDE_RATIO = 1.8;
const GUIDE_BORDER = 2;

export function ScanBookScreen({ navigation }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [feedback, setFeedback] = useState<string | null>(null);
  // La cámara dispara el evento muchas veces por segundo: tras el primer ISBN válido se ignora el resto.
  const handled = useRef(false);

  const handleScanned = ({ data }: BarcodeScanningResult) => {
    if (handled.current) return;
    const parsed = parseIsbn(data);
    if (!parsed.ok) {
      setFeedback(getScanFeedback(parsed.reason));
      return;
    }
    handled.current = true;
    // Vuelve al formulario (que sigue en la pila) entregándole el ISBN.
    navigation.popTo('AddBook', { scannedIsbn: parsed.isbn13 }, { merge: true });
  };

  // Mientras se consulta el permiso: el hueco oscuro donde irá la cámara, no una pantalla en blanco.
  if (!permission) return <View style={styles.viewfinder} />;

  if (!permission.granted) {
    return (
      <EmptyState
        icon="camera-outline"
        title="Permite el acceso a la cámara"
        action={
          permission.canAskAgain
            ? { label: 'Permitir', onPress: requestPermission }
            : { label: 'Abrir ajustes', onPress: () => Linking.openSettings() }
        }
      />
    );
  }

  return (
    <View style={styles.flex}>
      <CameraView
        style={styles.flex}
        facing="back"
        accessibilityLabel="Cámara para escanear el código de barras del libro"
        barcodeScannerSettings={{ barcodeTypes: ['ean13'] }}
        onBarcodeScanned={handleScanned}
      />
      {/* Recuadro guía sobre la imagen; no captura toques. */}
      <View style={[StyleSheet.absoluteFill, styles.guideLayer]} pointerEvents="none">
        <View style={styles.guide} />
      </View>
      <View style={styles.panel}>
        <Text style={styles.panelText} accessibilityLiveRegion="polite">
          {feedback ?? 'Apunta al código de barras del libro'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.textPrimary },
  viewfinder: { flex: 1, backgroundColor: colors.textPrimary },
  guideLayer: { alignItems: 'center', justifyContent: 'center' },
  guide: {
    width: GUIDE_WIDTH,
    aspectRatio: GUIDE_RATIO,
    borderWidth: GUIDE_BORDER,
    borderColor: colors.background,
    borderRadius: radius.md,
  },
  // Panel sólido (Porcelain sobre Evergreen, 14:1) para que el texto se lea sea cual sea la imagen de la cámara.
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.lg,
    backgroundColor: colors.textPrimary,
  },
  panelText: {
    textAlign: 'center',
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.background,
  },
});
