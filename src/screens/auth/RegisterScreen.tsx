import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput } from 'react-native';

import { AuthLayout } from '../../components/AuthLayout';
import { Button } from '../../components/Button';
import { GoogleSignInButton } from '../../components/GoogleSignInButton';
import { TextField } from '../../components/TextField';
import { useAuth } from '../../context/AuthContext';
import type { AuthStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { fontSize } from '../../theme/typography';
import { getAuthErrorMessage } from '../../utils/authErrors';
import {
  MAX_DISPLAY_NAME_LENGTH,
  MAX_NICKNAME_LENGTH,
  MIN_PASSWORD_LENGTH,
  isValidDisplayName,
  isValidEmail,
  isValidNickname,
  isValidPassword,
} from '../../utils/validation';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export function RegisterScreen({ navigation }: Props) {
  const { signUp } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const nicknameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmationRef = useRef<TextInput>(null);

  // Al enfocar los últimos campos, baja hasta el final una vez que el teclado ha terminado de aparecer.
  const scrollToEnd = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 250);
  };

  const handleSubmit = async () => {
    if (!isValidDisplayName(displayName)) {
      setError(`Introduce tu nombre (máximo ${MAX_DISPLAY_NAME_LENGTH} caracteres).`);
      return;
    }
    if (!isValidNickname(nickname)) {
      setError(`El apodo no puede superar ${MAX_NICKNAME_LENGTH} caracteres.`);
      return;
    }
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
      await signUp(email, password, { displayName, nickname });
    } catch (e) {
      setError(getAuthErrorMessage(e));
      setLoading(false);
    }
    // En caso de éxito, AppNavigator reemplaza esta pantalla al cambiar la sesión.
  };

  return (
    <AuthLayout title="Crear cuenta" subtitle="Tu biblioteca será privada y solo tuya." scrollRef={scrollRef}>
      <TextField
        label="Nombre"
        value={displayName}
        onChangeText={setDisplayName}
        autoCapitalize="words"
        autoComplete="name"
        maxLength={MAX_DISPLAY_NAME_LENGTH}
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => nicknameRef.current?.focus()}
      />
      <TextField
        ref={nicknameRef}
        label="Apodo (opcional)"
        value={nickname}
        onChangeText={setNickname}
        autoCapitalize="none"
        maxLength={MAX_NICKNAME_LENGTH}
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => emailRef.current?.focus()}
      />
      <TextField
        ref={emailRef}
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
        autoComplete="new-password"
        returnKeyType="next"
        submitBehavior="submit"
        onFocus={scrollToEnd}
        onSubmitEditing={() => confirmationRef.current?.focus()}
      />
      <TextField
        ref={confirmationRef}
        label="Confirmar contraseña"
        value={confirmation}
        onChangeText={setConfirmation}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        returnKeyType="done"
        onFocus={scrollToEnd}
        onSubmitEditing={handleSubmit}
      />
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <Button title="Crear cuenta" onPress={handleSubmit} loading={loading} />
      <GoogleSignInButton onError={setError} disabled={loading} />
      <Button title="Ya tengo una cuenta" variant="secondary" onPress={() => navigation.goBack()} />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  error: { fontSize: fontSize.sm, color: colors.error },
});
