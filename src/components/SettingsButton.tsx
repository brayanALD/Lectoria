import { Ionicons } from '@expo/vector-icons';
import { StyleSheet } from 'react-native';

import { useSettings } from '../context/SettingsContext';
import { makeStyles, useTheme } from '../context/ThemeContext';
import { useLayout } from '../hooks/useLayout';
import { iconSize, minTouchSize, opacity } from '../theme/spacing';
import { PressableScale } from './PressableScale';

/**
 * La tuerca de la esquina superior derecha de los encabezados: abre el panel de configuración. En la web de escritorio
 * la abre la barra lateral (`Sidebar`), así que aquí no se repite.
 */
export function SettingsButton() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { open } = useSettings();
  const { isWide } = useLayout();

  if (isWide) return null;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel="Configuración"
      accessibilityHint="Abre el panel de configuración"
      onPress={open}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Ionicons name="settings-outline" size={iconSize.lg} color={colors.primary} />
    </PressableScale>
  );
}

const useStyles = makeStyles(() =>
  StyleSheet.create({
    button: { width: minTouchSize, height: minTouchSize, alignItems: 'center', justifyContent: 'center' },
    pressed: { opacity: opacity.pressed },
  }),
);
