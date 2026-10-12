import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { colors } from '../theme/colors';

export function LoadingSpinner() {
  return (
    <View style={styles.container} accessibilityRole="progressbar" accessibilityLabel="Cargando">
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
});
