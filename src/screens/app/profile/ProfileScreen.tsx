import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '../../../components/Button';
import { TextField } from '../../../components/TextField';
import { useAuth } from '../../../context/AuthContext';
import { colors } from '../../../theme/colors';
import { spacing } from '../../../theme/spacing';
import { fontSize, fontWeight } from '../../../theme/typography';
import { getAuthErrorMessage } from '../../../utils/authErrors';
import { MIN_PASSWORD_LENGTH, isValidPassword } from '../../../utils/validation';

export function ProfileScreen() {
  const { user, hasGoogle, hasPassword, linkGoogle, linkPassword, signOut } = useAuth();
  const [linkingGoogle, setLinkingGoogle] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLinkGoogle = async () => {
    setError(null);
    setLinkingGoogle(true);
    try {
      await linkGoogle();
    } catch (e) {
      setError(getAuthErrorMessage(e));
    } finally {
      setLinkingGoogle(false);
    }
  };

  const closePasswordForm = () => {
    setShowPasswordForm(false);
    setPassword('');
    setConfirmation('');
  };

  const handleLinkPassword = async () => {
    if (!isValidPassword(password)) {
      setError(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }
    if (password !== confirmation) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setError(null);
    setSavingPassword(true);
    try {
      await linkPassword(password);
      closePasswordForm();
    } catch (e) {
      setError(getAuthErrorMessage(e));
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      <View style={styles.block}>
        <Text style={styles.label}>Cuenta</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      <View style={styles.block}>
        <Text style={styles.sectionTitle}>Métodos de acceso</Text>
        <Text style={styles.hint}>Vincula los dos para poder entrar con cualquiera de ellos.</Text>

        <View style={styles.method}>
          <Text style={styles.methodName}>Google</Text>
          {hasGoogle ? (
            <Text style={styles.linked}>Vinculado</Text>
          ) : (
            <Button title="Vincular Google" variant="secondary" onPress={handleLinkGoogle} loading={linkingGoogle} />
          )}
        </View>

        <View style={styles.method}>
          <Text style={styles.methodName}>Correo y contraseña</Text>
          {hasPassword ? (
            <Text style={styles.linked}>Vinculado</Text>
          ) : showPasswordForm ? (
            <View style={styles.form}>
              <TextField
                label="Nueva contraseña"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="new-password"
                returnKeyType="next"
              />
              <TextField
                label="Confirmar contraseña"
                value={confirmation}
                onChangeText={setConfirmation}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="new-password"
                returnKeyType="done"
                onSubmitEditing={handleLinkPassword}
              />
              <Button title="Guardar contraseña" onPress={handleLinkPassword} loading={savingPassword} />
              <Button title="Cancelar" variant="secondary" onPress={closePasswordForm} disabled={savingPassword} />
            </View>
          ) : (
            <Button
              title="Crear contraseña"
              variant="secondary"
              onPress={() => {
                setError(null);
                setShowPasswordForm(true);
              }}
            />
          )}
        </View>

        {error ? (
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
      </View>

      <Button title="Cerrar sesión" variant="secondary" onPress={signOut} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl * 4 },
  block: { gap: spacing.sm },
  label: { fontSize: fontSize.sm, color: colors.textSecondary },
  email: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.textPrimary },
  hint: { fontSize: fontSize.sm, color: colors.textSecondary },
  method: { gap: spacing.sm, marginTop: spacing.sm },
  methodName: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  linked: { fontSize: fontSize.md, color: colors.success },
  form: { gap: spacing.md },
  error: { fontSize: fontSize.sm, color: colors.error },
});
