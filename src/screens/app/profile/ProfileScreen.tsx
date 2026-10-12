import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../../../components/Button';
import { useAuth } from '../../../context/AuthContext';
import { colors } from '../../../theme/colors';
import { spacing } from '../../../theme/spacing';
import { fontSize, fontWeight } from '../../../theme/typography';

export function ProfileScreen() {
  const { user, signOut } = useAuth();

  return (
    <View style={styles.container}>
      <View style={styles.account}>
        <Text style={styles.label}>Cuenta</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>
      <Button title="Cerrar sesión" variant="secondary" onPress={signOut} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, gap: spacing.lg, backgroundColor: colors.background },
  account: { gap: spacing.xs },
  label: { fontSize: fontSize.sm, color: colors.textSecondary },
  email: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.textPrimary },
});
