import { Image, StyleSheet, View } from 'react-native';

import { colors } from '../theme/colors';

// Mismo logo, ancho y fondo que la pantalla de inicio nativa (ver expo-splash-screen en app.json):
// al terminar de restaurar la sesión no hay salto visual ni pantalla en blanco.
const logo = require('../../assets/splash-icon.png');
const LOGO_WIDTH = 280;

export function StartupScreen() {
  return (
    <View style={styles.container} accessible accessibilityLabel="Lectoria" accessibilityState={{ busy: true }}>
      <Image source={logo} style={styles.logo} resizeMode="contain" accessible={false} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandSurface },
  logo: { width: LOGO_WIDTH, height: LOGO_WIDTH },
});
