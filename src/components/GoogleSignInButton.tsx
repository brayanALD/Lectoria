import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { fontSize } from '../theme/typography';
import { getAuthErrorMessage } from '../utils/authErrors';
import { Button } from './Button';

interface GoogleSignInButtonProps {
  /** Se llama con un mensaje en español, o con null al iniciar un nuevo intento. */
  onError: (message: string | null) => void;
  disabled?: boolean;
}

// Separador «o» + botón de acceso con Google, común a Login y Registro.
export function GoogleSignInButton({ onError, disabled = false }: GoogleSignInButtonProps) {
  const { signInWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);

  const handlePress = async () => {
    onError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      onError(getAuthErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.divider}>
        <View style={styles.line} />
        <Text style={styles.dividerText}>o</Text>
        <View style={styles.line} />
      </View>
      <Button title="Continuar con Google" variant="secondary" onPress={handlePress} loading={loading} disabled={disabled} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { fontSize: fontSize.sm, color: colors.textSecondary },
});
