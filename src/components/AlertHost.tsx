import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { makeStyles } from '../context/ThemeContext';
import { elevation } from '../theme/elevation';
import { layout, radius, spacing } from '../theme/spacing';
import { fontFamily, fontSize } from '../theme/typography';
import { subscribeToAlerts, type AlertRequest } from './alert';
import { Button } from './Button';

/**
 * Pinta en la web los diálogos de `showAlert` (confirmaciones de eliminar, descartar, etc.), con el tema de la app. En el
 * móvil no hace nada: allí `showAlert` usa el diálogo nativo. Se monta una sola vez, en la raíz.
 */
export function AlertHost() {
  const styles = useStyles();
  const [request, setRequest] = useState<AlertRequest | null>(null);

  useEffect(() => subscribeToAlerts(setRequest), []);

  if (!request) return null;

  const close = () => setRequest(null);
  const dismiss = () => {
    close();
    request.onDismiss?.();
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={dismiss}>
      <View style={styles.root}>
        <Pressable style={styles.overlay} onPress={dismiss} accessibilityRole="button" accessibilityLabel="Cerrar" />
        <View style={styles.dialog} accessibilityViewIsModal accessibilityRole="alert">
          <Text style={styles.title} accessibilityRole="header">
            {request.title}
          </Text>
          {request.message ? <Text style={styles.message}>{request.message}</Text> : null}
          <View style={styles.actions}>
            {request.buttons.map((button, index) => (
              <View key={`${button.text}-${index}`} style={styles.action}>
                <Button
                  title={button.text ?? 'Aceptar'}
                  variant={button.style === 'destructive' ? 'danger' : button.style === 'cancel' ? 'secondary' : 'primary'}
                  onPress={() => {
                    close();
                    button.onPress?.();
                  }}
                />
              </View>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((colors) =>
  StyleSheet.create({
    root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
    overlay: { ...StyleSheet.absoluteFill, backgroundColor: colors.overlay },
    dialog: {
      width: '100%',
      maxWidth: layout.dialogMaxWidth - spacing.xl * 2,
      gap: spacing.md,
      padding: spacing.lg,
      borderRadius: radius.lg,
      backgroundColor: colors.background,
      ...elevation.dialog,
    },
    title: { fontSize: fontSize.lg, fontFamily: fontFamily.display, color: colors.textPrimary },
    message: { fontSize: fontSize.md, fontFamily: fontFamily.regular, color: colors.textSecondary },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
    action: { flexGrow: 1, flexBasis: '40%' },
  }),
);
