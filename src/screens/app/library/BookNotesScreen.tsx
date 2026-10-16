import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Button } from '../../../components/Button';
import { FormLayout } from '../../../components/FormLayout';
import { TextField } from '../../../components/TextField';
import { useAuth } from '../../../context/AuthContext';
import { makeStyles } from '../../../context/ThemeContext';
import type { AppStackParamList } from '../../../navigation/types';
import { saveBookNotes } from '../../../services/booksService';
import type { UserBookWithId } from '../../../types/book';
import { minTouchSize, spacing } from '../../../theme/spacing';
import { fontFamily, fontSize } from '../../../theme/typography';
import { getFirestoreErrorMessage } from '../../../utils/firestoreErrors';
import { MAX_NOTES_LENGTH, parseNotes } from '../../../utils/review';
import { withTimeout } from '../../../utils/withTimeout';
import { BookGate } from './BookGate';

type Props = NativeStackScreenProps<AppStackParamList, 'BookNotes'>;

// Sin conexión, una escritura de Firestore no termina hasta recuperar la red: se corta la espera.
const SAVE_TIMEOUT_MS = 10000;
const NOTES_MIN_HEIGHT = minTouchSize * 5;

/**
 * Las notas de un libro: un espacio libre para lo que se quiera recordar mientras se lee (ideas, fragmentos,
 * pensamientos). Es independiente de la reseña, que se escribe aparte y al terminar.
 */
export function BookNotesScreen({ navigation, route }: Props) {
  return (
    <BookGate bookId={route.params.bookId} onBack={() => navigation.goBack()}>
      {(book) => <NotesForm book={book} onSaved={() => navigation.goBack()} />}
    </BookGate>
  );
}

function NotesForm({ book, onSaved }: { book: UserBookWithId; onSaved: () => void }) {
  const styles = useStyles();
  const { user } = useAuth();
  // Las notas se cargan una vez al abrir; lo que se escribe no se pisa con cambios que lleguen del servidor.
  const [text, setText] = useState(book.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (saving) return;
    const result = parseNotes(text);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    setSubmitError(null);
    setSaving(true);
    try {
      if (!user) throw new Error('No hay sesión iniciada');
      await withTimeout(saveBookNotes(user.uid, book, result.notes), SAVE_TIMEOUT_MS);
      onSaved();
    } catch (e) {
      setSubmitError(getFirestoreErrorMessage(e));
      setSaving(false);
    }
  };

  return (
    <FormLayout>
      <TextField
        label="Notas"
        placeholder="Ideas, fragmentos, pensamientos…"
        value={text}
        onChangeText={(value) => {
          setText(value);
          setError(null);
        }}
        error={error ?? undefined}
        multiline
        textAlignVertical="top"
        maxLength={MAX_NOTES_LENGTH}
        autoCapitalize="sentences"
        style={styles.multiline}
      />
      {submitError ? (
        <Text style={styles.error} accessibilityRole="alert">
          {submitError}
        </Text>
      ) : null}
      <Button title="Guardar notas" onPress={handleSave} loading={saving} />
    </FormLayout>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  multiline: { minHeight: NOTES_MIN_HEIGHT, paddingVertical: spacing.sm },
  error: { fontSize: fontSize.sm, fontFamily: fontFamily.regular, color: colors.error },
}));
