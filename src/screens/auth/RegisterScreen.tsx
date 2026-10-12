import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { AuthLayout } from '../../components/AuthLayout';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { useAuth } from '../../context/AuthContext';
import type { AuthStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { fontSize } from '../../theme/typography';
import { getAuthErrorMessage } from '../../utils/authErrors';
import { MIN_PASSWORD_LENGTH, isValidEmail, isValidPassword } from '../../utils/validation';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export function RegisterScreen({ navigation }: Props) {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!isValidEmail(email)) {
      setError('Introduce un correo válido.');
      return;
    }
    if (!isValidPassword(password)) {
      setError(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }
    if (password !== confirmation) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await signUp(email, password);
    } catch (e) {
      setError(getAuthErrorMessage(e));
      setLoading(false);
    }
    // En caso de éxito, AppNavigator reemplaza esta pantalla al cambiar la sesión.
  };

  return (
    <AuthLayout title="Crear cuenta" subtitle="Tu biblioteca será privada y solo tuya.">
      <TextField
        label="Correo electrónico"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
      />
      <TextField
        label="Contraseña"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
      />
      <TextField
        label="Confirmar contraseña"
        value={confirmation}
        onChangeText={setConfirmation}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        onSubmitEditing={handleSubmit}
      />
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <Button title="Crear cuenta" onPress={handleSubmit} loading={loading} />
      <Button title="Ya tengo una cuenta" variant="secondary" onPress={() => navigation.goBack()} />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  error: { fontSize: fontSize.sm, color: colors.error },
});
