import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../../../components/Button';
import { FormLayout } from '../../../components/FormLayout';
import { StarRatingInput } from '../../../components/StarRating';
import { TextField } from '../../../components/TextField';
import { useAuth } from '../../../context/AuthContext';
import { makeStyles } from '../../../context/ThemeContext';
import type { AppStackParamList } from '../../../navigation/types';
import { saveBookReview } from '../../../services/booksService';
import type { UserBookWithId } from '../../../types/book';
import { minTouchSize, radius, spacing } from '../../../theme/spacing';
import { fontFamily, fontSize } from '../../../theme/typography';
import { getFirestoreErrorMessage } from '../../../utils/firestoreErrors';
import {
  MAX_REVIEW_LENGTH,
  MAX_SPECIFIC_REVIEWS,
  MAX_SPECIFIC_REVIEW_LENGTH,
  MAX_TOPIC_LENGTH,
  parseReviewForm,
  reviewToFormValues,
  type ReviewFormErrors,
  type SpecificReviewInput,
} from '../../../utils/review';
import { withTimeout } from '../../../utils/withTimeout';
import { BookGate } from './BookGate';

type Props = NativeStackScreenProps<AppStackParamList, 'BookReview'>;

// Sin conexión, una escritura de Firestore no termina hasta recuperar la red: se corta la espera.
const SAVE_TIMEOUT_MS = 10000;
const GENERAL_MIN_HEIGHT = minTouchSize * 3;
const SPECIFIC_MIN_HEIGHT = minTouchSize * 2;

/**
 * La reseña de un libro: la calificación en estrellas (de media en media), la opinión general y, si se quiere, reseñas
 * de aspectos concretos cuyo tema escribe la persona (los personajes, la trama, el final…). Todo es opcional. Es
 * independiente de las notas, que se escriben aparte durante la lectura.
 */
export function BookReviewScreen({ navigation, route }: Props) {
  return (
    <BookGate bookId={route.params.bookId} onBack={() => navigation.goBack()}>
      {(book) => <ReviewForm book={book} onSaved={() => navigation.goBack()} />}
    </BookGate>
  );
}

function ReviewForm({ book, onSaved }: { book: UserBookWithId; onSaved: () => void }) {
  const styles = useStyles();
  const { user } = useAuth();
  // Se carga una vez al abrir; lo que se escribe no se pisa con cambios que lleguen del servidor.
  const [values, setValues] = useState(() => reviewToFormValues(book));
  const [errors, setErrors] = useState<ReviewFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Identificador de los bloques nuevos (los guardados traen el suyo).
  const nextId = useRef(0);

  const addSpecific = () => {
    const id = `new-${nextId.current++}`;
    setValues((current) => ({ ...current, specific: [...current.specific, { id, topic: '', text: '' }] }));
  };

  const changeSpecific = (id: string, changes: Partial<Omit<SpecificReviewInput, 'id'>>) => {
    setValues((current) => ({
      ...current,
      specific: current.specific.map((item) => (item.id === id ? { ...item, ...changes } : item)),
    }));
    // Editar un campo limpia su error, para que se vea que ya está corregido.
    setErrors((current) => {
      const field = current.specific?.[id];
      if (!field) return current;
      const cleared = { ...field };
      for (const key of Object.keys(changes) as (keyof typeof changes)[]) delete cleared[key];
      return { ...current, specific: { ...current.specific, [id]: cleared } };
    });
  };

  const removeSpecific = (id: string) => {
    setValues((current) => ({ ...current, specific: current.specific.filter((item) => item.id !== id) }));
  };

  const handleSave = async () => {
    if (saving) return;
    const result = parseReviewForm(values);
    if (!result.ok) {
      setErrors(result.errors);
      setSubmitError(null);
      return;
    }
    setErrors({});
    setSubmitError(null);
    setSaving(true);
    try {
      if (!user) throw new Error('No hay sesión iniciada');
      await withTimeout(saveBookReview(user.uid, book, result.data), SAVE_TIMEOUT_MS);
      onSaved();
    } catch (e) {
      setSubmitError(getFirestoreErrorMessage(e));
      setSaving(false);
    }
  };

  return (
    <FormLayout>
      <View style={styles.group}>
        <Text style={styles.label}>Calificación</Text>
        <StarRatingInput value={values.rating} onChange={(rating) => setValues((current) => ({ ...current, rating }))} />
        {errors.rating ? (
          <Text style={styles.error} accessibilityRole="alert">
            {errors.rating}
          </Text>
        ) : null}
      </View>

      <TextField
        label="Reseña"
        placeholder="¿Qué te pareció?"
        value={values.review}
        onChangeText={(review) => {
          setValues((current) => ({ ...current, review }));
          setErrors((current) => ({ ...current, review: undefined }));
        }}
        error={errors.review}
        multiline
        textAlignVertical="top"
        maxLength={MAX_REVIEW_LENGTH}
        autoCapitalize="sentences"
        style={[styles.multiline, { minHeight: GENERAL_MIN_HEIGHT }]}
      />

      {/* Cada reseña específica lleva el tema que la persona escribe y su texto; se puede quitar. */}
      {values.specific.map((item) => (
        <View key={item.id} style={styles.specific}>
          <TextField
            label="Tema"
            placeholder="Ej. personajes, trama, el final"
            value={item.topic}
            onChangeText={(topic) => changeSpecific(item.id, { topic })}
            error={errors.specific?.[item.id]?.topic}
            maxLength={MAX_TOPIC_LENGTH}
            autoCapitalize="sentences"
            // Un bloque recién añadido pide el tema al abrirse; los guardados no roban el foco.
            autoFocus={item.id.startsWith('new-')}
            action={{
              icon: 'close-circle-outline',
              label: `Quitar la reseña${item.topic.trim() ? ` de ${item.topic.trim()}` : ' específica'}`,
              onPress: () => removeSpecific(item.id),
            }}
          />
          <TextField
            label={item.topic.trim() ? `Reseña de ${item.topic.trim()}` : 'Reseña del tema'}
            value={item.text}
            onChangeText={(text) => changeSpecific(item.id, { text })}
            error={errors.specific?.[item.id]?.text}
            multiline
            textAlignVertical="top"
            maxLength={MAX_SPECIFIC_REVIEW_LENGTH}
            autoCapitalize="sentences"
            style={[styles.multiline, { minHeight: SPECIFIC_MIN_HEIGHT }]}
          />
        </View>
      ))}

      {errors.specificList ? (
        <Text style={styles.error} accessibilityRole="alert">
          {errors.specificList}
        </Text>
      ) : null}
      {values.specific.length < MAX_SPECIFIC_REVIEWS ? (
        <Button title="Añadir reseña específica" variant="secondary" onPress={addSpecific} />
      ) : null}

      {submitError ? (
        <Text style={styles.error} accessibilityRole="alert">
          {submitError}
        </Text>
      ) : null}
      <Button title="Guardar reseña" onPress={handleSave} loading={saving} />
    </FormLayout>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  group: { gap: spacing.xs },
  label: { fontSize: fontSize.sm, fontFamily: fontFamily.semibold, color: colors.textPrimary },
  multiline: { paddingVertical: spacing.sm },
  // Los dos campos de una reseña específica van juntos, sobre un bloque tonal.
  specific: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceTint },
  error: { fontSize: fontSize.sm, fontFamily: fontFamily.regular, color: colors.error },
}));
