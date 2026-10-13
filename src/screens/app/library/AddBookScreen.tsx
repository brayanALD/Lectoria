import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '../../../components/Button';
import { StatusSelector } from '../../../components/StatusSelector';
import { TextField } from '../../../components/TextField';
import { useAuth } from '../../../context/AuthContext';
import { useWindowTop } from '../../../hooks/useWindowTop';
import type { AppStackParamList } from '../../../navigation/types';
import { createBook } from '../../../services/booksService';
import type { BookFormErrors, BookFormValues } from '../../../types/book';
import { colors } from '../../../theme/colors';
import { spacing } from '../../../theme/spacing';
import { fontSize } from '../../../theme/typography';
import {
  EMPTY_BOOK_FORM,
  MAX_PAGE_COUNT,
  MAX_SERIES_NAME_LENGTH,
  MAX_TITLE_LENGTH,
  parseBookForm,
} from '../../../utils/book';
import { getFirestoreErrorMessage } from '../../../utils/firestoreErrors';
import { withTimeout } from '../../../utils/withTimeout';

type Props = NativeStackScreenProps<AppStackParamList, 'AddBook'>;

// Sin conexión, una escritura de Firestore no termina hasta recuperar la red: se corta la espera.
const SAVE_TIMEOUT_MS = 10000;

export function AddBookScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [values, setValues] = useState<BookFormValues>(EMPTY_BOOK_FORM);
  const [errors, setErrors] = useState<BookFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { ref: containerRef, top, onLayout } = useWindowTop();
  const scrollRef = useRef<ScrollView>(null);
  const authorsRef = useRef<TextInput>(null);
  const pagesRef = useRef<TextInput>(null);
  const genresRef = useRef<TextInput>(null);
  const seriesRef = useRef<TextInput>(null);
  const seriesOrderRef = useRef<TextInput>(null);

  // Editar un campo limpia su error, para que el usuario vea que ya está corregido.
  const setField = <K extends keyof BookFormValues>(field: K) => (value: BookFormValues[K]) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));
  };

  const handleSubmit = async () => {
    if (saving || !user) return;

    const result = parseBookForm(values);
    if (!result.ok) {
      setErrors(result.errors);
      setSubmitError(null);
      // Los campos obligatorios están al principio del formulario.
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }

    setErrors({});
    setSubmitError(null);
    setSaving(true);
    try {
      await withTimeout(createBook(user.uid, result.data), SAVE_TIMEOUT_MS);
      navigation.goBack();
    } catch (error) {
      setSubmitError(getFirestoreErrorMessage(error));
      setSaving(false);
    }
  };

  return (
    <View ref={containerRef} onLayout={onLayout} style={styles.flex}>
      <KeyboardAvoidingView style={styles.flex} behavior="padding" keyboardVerticalOffset={top}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <TextField
            label="Título *"
            value={values.title}
            onChangeText={setField('title')}
            error={errors.title}
            maxLength={MAX_TITLE_LENGTH}
            autoCapitalize="sentences"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => authorsRef.current?.focus()}
          />
          <TextField
            ref={authorsRef}
            label="Autor(es) *"
            hint="Separa varios autores con coma."
            value={values.authors}
            onChangeText={setField('authors')}
            error={errors.authors}
            autoCapitalize="words"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => pagesRef.current?.focus()}
          />
          <TextField
            ref={pagesRef}
            label="Páginas"
            value={values.pageCount}
            onChangeText={setField('pageCount')}
            error={errors.pageCount}
            keyboardType="number-pad"
            maxLength={String(MAX_PAGE_COUNT).length}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => genresRef.current?.focus()}
          />
          <TextField
            ref={genresRef}
            label="Géneros"
            hint="Separa varios géneros con coma."
            value={values.genres}
            onChangeText={setField('genres')}
            error={errors.genres}
            autoCapitalize="sentences"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => seriesRef.current?.focus()}
          />
          <TextField
            ref={seriesRef}
            label="Saga"
            value={values.seriesName}
            onChangeText={setField('seriesName')}
            error={errors.seriesName}
            maxLength={MAX_SERIES_NAME_LENGTH}
            autoCapitalize="words"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => seriesOrderRef.current?.focus()}
          />
          <TextField
            ref={seriesOrderRef}
            label="Número en la saga"
            value={values.seriesOrder}
            onChangeText={setField('seriesOrder')}
            error={errors.seriesOrder}
            keyboardType="number-pad"
            maxLength={4}
            returnKeyType="done"
          />

          <StatusSelector value={values.status} onChange={setField('status')} error={errors.status} />

          {submitError ? (
            <Text style={styles.error} accessibilityRole="alert">
              {submitError}
            </Text>
          ) : null}

          <Button title="Guardar libro" onPress={handleSubmit} loading={saving} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl * 3 },
  error: { fontSize: fontSize.sm, color: colors.error },
});
