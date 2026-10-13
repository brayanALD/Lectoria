import { useState } from 'react';
import { Image, StyleSheet } from 'react-native';

import { useAuth } from '../context/AuthContext';
import { iconSize } from '../theme/spacing';
import { getAuthErrorMessage } from '../utils/authErrors';
import { Button } from './Button';

// Logo «G» de Google (144 px, mostrado a 20 pt). No modificar colores ni proporciones.
const googleLogo = require('../../assets/google-g.png');

interface GoogleSignInButtonProps {
  /** Se llama con un mensaje en español, o con null al iniciar un nuevo intento. */
  onError: (message: string | null) => void;
  disabled?: boolean;
}

// Botón de acceso con Google, común a Login y Registro.
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
    <Button
      title="Continuar con Google"
      variant="google"
      icon={<Image source={googleLogo} style={styles.logo} accessible={false} />}
      onPress={handlePress}
      loading={loading}
      disabled={disabled}
    />
  );
}

const styles = StyleSheet.create({
  logo: { width: iconSize.sm, height: iconSize.sm },
});
