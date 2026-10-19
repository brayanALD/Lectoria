import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '../../../components/Button';
import { NavRow } from '../../../components/NavRow';
import { TextField } from '../../../components/TextField';
import { useAuth } from '../../../context/AuthContext';
import { makeStyles } from '../../../context/ThemeContext';
import { useBooks } from '../../../hooks/useBooks';
import { useCollections } from '../../../hooks/useCollections';
import type { AppStackParamList } from '../../../navigation/types';
import { minTouchSize, radius, spacing } from '../../../theme/spacing';
import { fontFamily, fontSize } from '../../../theme/typography';
import { getAuthErrorMessage } from '../../../utils/authErrors';
import { summarizeAuthors } from '../../../utils/authors';
import { summarizeSeries } from '../../../utils/series';
import { MIN_PASSWORD_LENGTH, isValidPassword } from '../../../utils/validation';
import { DeleteAccountSheet } from './DeleteAccountSheet';

/** «3 autores», «1 saga»: la cuenta con su nombre en singular o plural. */
function formatCount(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function ProfileScreen() {
  const styles = useStyles();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { books, loading: booksLoading } = useBooks();
  const { collections, loading: collectionsLoading } = useCollections();
  // Autores y sagas se derivan de los libros; las cuentas solo se muestran cuando ya hay datos.
  const authorCount = useMemo(() => summarizeAuthors(books).length, [books]);
  const seriesCount = useMemo(() => summarizeSeries(books).length, [books]);
  const { user, hasGoogle, hasPassword, linkGoogle, linkPassword, signOut } = useAuth();
  const [linkingGoogle, setLinkingGoogle] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

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

      <View style={styles.library}>
        <NavRow
          title="Colecciones"
          subtitle={collectionsLoading || booksLoading ? undefined : formatCount(collections.length, 'colección', 'colecciones')}
          icon="albums-outline"
          onPress={() => navigation.navigate('Collections')}
        />
        <NavRow
          title="Sagas"
          subtitle={booksLoading ? undefined : formatCount(seriesCount, 'saga', 'sagas')}
          icon="layers-outline"
          onPress={() => navigation.navigate('Series')}
        />
        <NavRow
          title="Autores"
          subtitle={booksLoading ? undefined : formatCount(authorCount, 'autor', 'autores')}
          icon="person-outline"
          onPress={() => navigation.navigate('Authors')}
        />
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
      <Button title="Eliminar cuenta" variant="danger" onPress={() => setDeleteOpen(true)} />
      <DeleteAccountSheet visible={deleteOpen} onClose={() => setDeleteOpen(false)} />
    </ScrollView>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl * 4 },
  block: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceTint },
  account: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  library: { gap: spacing.sm },
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
}));
