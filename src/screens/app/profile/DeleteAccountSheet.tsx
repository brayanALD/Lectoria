import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../../../components/Button';
import { Sheet } from '../../../components/Sheet';
import { TextField } from '../../../components/TextField';
import { useAuth } from '../../../context/AuthContext';
import { makeStyles } from '../../../context/ThemeContext';
import { spacing } from '../../../theme/spacing';
import { fontFamily, fontSize } from '../../../theme/typography';
import { getDeleteAccountErrorMessage } from '../../../utils/authErrors';

interface DeleteAccountSheetProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * Hoja para eliminar la cuenta con todos sus datos. Pide confirmar la identidad: la contraseña si la cuenta tiene una o,
 * si solo entra con Google, el selector de cuentas de Google. Al terminar la sesión se cierra sola y esta hoja desaparece.
 */
export function DeleteAccountSheet({ visible, onClose }: DeleteAccountSheetProps) {
  const styles = useStyles();
  const { hasPassword, deleteAccount } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Cada vez que se abre arranca limpia.
  useEffect(() => {
    if (visible) {
      setPassword('');
      setError(null);
    }
  }, [visible]);

  const handleDelete = async () => {
    if (deleting) return;
    if (hasPassword && !password) {
      setError('Escribe tu contraseña para confirmar.');
      return;
    }
    setError(null);
    setDeleting(true);
    try {
      const done = await deleteAccount(hasPassword ? password : undefined);
      // Si se canceló el selector de Google no se hizo nada. Si se eliminó, la sesión se cierra y la hoja desaparece.
      if (!done) setDeleting(false);
    } catch (e) {
      setError(getDeleteAccountErrorMessage(e));
      setDeleting(false);
    }
  };

  return (
    // Mientras se borra no se puede cerrar: dejaría la operación a medias sin que se vea.
    <Sheet visible={visible} onClose={deleting ? () => {} : onClose}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          Eliminar cuenta
        </Text>
        <Text style={styles.warning}>
          Se borrarán para siempre tu biblioteca, tus lecturas, tus metas y tu perfil. No se puede deshacer.
        </Text>
      </View>

      {hasPassword ? (
        <TextField
          label="Contraseña"
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            setError(null);
          }}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
          returnKeyType="done"
          onSubmitEditing={handleDelete}
          editable={!deleting}
        />
      ) : null}

      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <Button
          title={hasPassword ? 'Eliminar mi cuenta' : 'Confirmar con Google y eliminar'}
          variant="danger"
          onPress={handleDelete}
          loading={deleting}
        />
        <Button title="Cancelar" variant="secondary" onPress={onClose} disabled={deleting} />
      </View>
    </Sheet>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  header: { gap: spacing.sm },
  title: { fontSize: fontSize.lg, fontFamily: fontFamily.display, color: colors.textPrimary },
  warning: { fontSize: fontSize.md, fontFamily: fontFamily.regular, color: colors.textSecondary },
  actions: { gap: spacing.sm },
  error: { fontSize: fontSize.sm, fontFamily: fontFamily.regular, color: colors.error },
}));
