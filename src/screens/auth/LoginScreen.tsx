import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useRef, useState } from 'react';
import { StyleSheet, Text, TextInput } from 'react-native';

import { AuthLayout } from '../../components/AuthLayout';
import { Button } from '../../components/Button';
import { GoogleSignInButton } from '../../components/GoogleSignInButton';
import { TextField } from '../../components/TextField';
import { useAuth } from '../../context/AuthContext';
import type { AuthStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { fontSize } from '../../theme/typography';
import { getAuthErrorMessage } from '../../utils/authErrors';
import { isValidEmail } from '../../utils/validation';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  const handleSubmit = async () => {
    if (!isValidEmail(email) || password.length === 0) {
      setError('Introduce un correo válido y tu contraseña.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (e) {
      setError(getAuthErrorMessage(e));
      setLoading(false);
    }
    // En caso de éxito, AppNavigator reemplaza esta pantalla al cambiar la sesión.
  };

  return (
    <AuthLayout title="Iniciar sesión" subtitle="Accede a tu biblioteca y a tu progreso de lectura.">
      <TextField
        label="Correo electrónico"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <TextField
        ref={passwordRef}
        label="Contraseña"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="current-password"
        returnKeyType="done"
        onSubmitEditing={handleSubmit}
      />
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <Button title="Entrar" onPress={handleSubmit} loading={loading} />
      <GoogleSignInButton onError={setError} disabled={loading} />
      <Button title="Crear una cuenta" variant="secondary" onPress={() => navigation.navigate('Register')} />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  error: { fontSize: fontSize.sm, color: colors.error },
});
