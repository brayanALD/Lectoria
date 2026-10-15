import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, BackHandler, Easing, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSettings } from '../context/SettingsContext';
import { makeStyles, useTheme } from '../context/ThemeContext';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { elevation } from '../theme/elevation';
import { iconSize, minTouchSize, opacity, radius, spacing } from '../theme/spacing';
import { fontFamily, fontSize } from '../theme/typography';
import { getPanelWidth } from '../utils/settingsPanel';
import { BlurBackdrop } from './BlurTarget';
import { AppearanceSection } from './settings/AppearanceSection';

const OPEN_MS = 260;
const CLOSE_MS = 200;

/**
 * Panel lateral de configuración: baja desde la derecha ocupando la mitad de la pantalla (con un mínimo en teléfonos), sobre el
 * contenido desenfocado y oscurecido. Se cierra tocando fuera, con el botón de cerrar o con «atrás» en Android. Se dibuja
 * una sola vez, en la raíz, como capa superpuesta (ver `BlurTarget`). Para añadir una opción, se crea su sección en
 * `components/settings` y se añade aquí.
 */
export function SettingsPanel() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { visible, close } = useSettings();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const panelWidth = getPanelWidth(width);

  // El panel sigue montado mientras se anima la salida.
  const [mounted, setMounted] = useState(visible);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) setMounted(true);
    const animation = Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: reduceMotion ? 0 : visible ? OPEN_MS : CLOSE_MS,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
    return () => animation.stop();
  }, [visible, reduceMotion, progress]);

  // «Atrás» de Android cierra el panel en lugar de salir de la pantalla.
  useEffect(() => {
    if (!visible) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => subscription.remove();
  }, [visible, close]);

  if (!mounted) return null;

  return (
    <View style={styles.root} accessibilityViewIsModal>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: progress }]}>
        <BlurBackdrop />
      </Animated.View>

      {/* Tocar fuera del panel lo cierra. */}
      <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityRole="button" accessibilityLabel="Cerrar configuración" />

      <Animated.View
        style={[
          styles.panel,
          {
            width: panelWidth,
            paddingTop: insets.top + spacing.md,
            paddingBottom: insets.bottom + spacing.md,
            transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [panelWidth, 0] }) }],
          },
        ]}
      >
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">
            Configuración
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
            onPress={close}
            style={({ pressed }) => [styles.close, pressed && styles.pressed]}
          >
            <Ionicons name="close" size={iconSize.lg} color={colors.textPrimary} />
          </Pressable>
        </View>

        <AppearanceSection />
      </Animated.View>
    </View>
  );
}

const useStyles = makeStyles((colors) =>
  StyleSheet.create({
    root: { ...StyleSheet.absoluteFill, alignItems: 'flex-end', zIndex: 10, elevation: 20 },
    panel: {
      height: '100%',
      paddingHorizontal: spacing.lg,
      gap: spacing.lg,
      borderTopLeftRadius: radius.lg,
      borderBottomLeftRadius: radius.lg,
      // Mismo fondo que la app (así los bordes de los controles cumplen 3:1) y un filo decorativo para separarlo del contenido.
      backgroundColor: colors.background,
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderLeftColor: colors.border,
      ...elevation.high,
    },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
    title: { flex: 1, fontSize: fontSize.lg, fontFamily: fontFamily.display, color: colors.textPrimary },
    close: { width: minTouchSize, height: minTouchSize, alignItems: 'center', justifyContent: 'center' },
    pressed: { opacity: opacity.pressed },
  }),
);
