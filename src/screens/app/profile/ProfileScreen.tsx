import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '../../../components/Button';
import { TextField } from '../../../components/TextField';
import { useAuth } from '../../../context/AuthContext';
import { colors } from '../../../theme/colors';
import { minTouchSize, radius, spacing } from '../../../theme/spacing';
import { fontFamily, fontSize } from '../../../theme/typography';
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
      <View style={styles.account}>
        <View style={styles.avatar} accessible={false} importantForAccessibility="no-hide-descendants">
          <Text style={styles.avatarInitial}>{(user?.email ?? '?').charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.email} numberOfLines={1}>
          {user?.email}
        </Text>
      </View>

      <View style={styles.block}>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          Métodos de acceso
        </Text>

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
  block: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceTint },
  account: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: minTouchSize + spacing.sm,
    height: minTouchSize + spacing.sm,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  avatarInitial: { fontSize: fontSize.lg, fontFamily: fontFamily.displayBold, color: colors.onAccent },
  email: { flex: 1, fontSize: fontSize.md, fontFamily: fontFamily.semibold, color: colors.textPrimary },
  sectionTitle: { fontSize: fontSize.lg, fontFamily: fontFamily.display, color: colors.textPrimary },
  method: { gap: spacing.sm, marginTop: spacing.sm },
  methodName: { fontSize: fontSize.md, fontFamily: fontFamily.semibold, color: colors.textPrimary },
  linked: { fontSize: fontSize.md, fontFamily: fontFamily.regular, color: colors.success },
  form: { gap: spacing.md },
  error: { fontSize: fontSize.sm, fontFamily: fontFamily.regular, color: colors.error },
});
