import { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useWindowTop } from '../hooks/useWindowTop';
import type { Acquisition, BookFormErrors, BookFormValues, CatalogBook, NewBookFields } from '../types/book';
import { makeStyles } from '../context/ThemeContext';
import { spacing } from '../theme/spacing';
import { fontFamily, fontSize } from '../theme/typography';
import { EMPTY_BOOK_FORM, MAX_PAGE_COUNT, MAX_SERIES_NAME_LENGTH, MAX_TITLE_LENGTH, parseBookForm } from '../utils/book';
import { ISBN_NOT_FOUND_MESSAGE, getCatalogErrorMessage } from '../utils/catalogErrors';
import { getFirestoreErrorMessage } from '../utils/firestoreErrors';
import { getIsbnErrorMessage, parseIsbn } from '../utils/isbn';
import { getSeriesSuggestions } from '../utils/seriesSuggestions';
import { withTimeout } from '../utils/withTimeout';
import { Button } from './Button';
import { StatusSelector } from './StatusSelector';
import { SuggestionList } from './SuggestionList';
import { TextField } from './TextField';

// Sin conexión, una escritura de Firestore no termina hasta recuperar la red: se corta la espera.
const SAVE_TIMEOUT_MS = 10000;
// Un ISBN-13 con cuatro guiones y algún espacio de más.
const ISBN_INPUT_MAX_LENGTH = 20;
// Referencia estable para el valor por defecto (evita recalcular las sugerencias en cada render).
const NO_SERIES: readonly string[] = [];

interface BookFormProps {
  /** Valores iniciales: vacíos para añadir, los del libro para editar. */
  initialValues?: BookFormValues;
  submitLabel: string;
  /** `wishlist`: el libro se guarda como deseo («Quiero leerlo», sin selector de estado). Por defecto, `owned`. */
  acquisition?: Acquisition;
  /** El estado se elige al añadir; al editar se cambia desde el detalle del libro. */
  showStatus?: boolean;
  /** Sagas ya registradas en la biblioteca; el campo «Saga» sugiere las que coinciden mientras se escribe. */
  seriesSuggestions?: readonly string[];
  /** Busca los datos de un ISBN en el catálogo. Si se indica, aparece el botón «Buscar por ISBN». */
  onLookup?: (isbn13: string) => Promise<CatalogBook | null>;
  /** Abre el escáner de código de barras. Si se indica, el campo ISBN muestra el botón de cámara. */
  onScan?: () => void;
  /** Un ISBN ya validado (p. ej. escaneado) que se escribe y busca al recibirlo. `id` distingue lecturas repetidas. */
  lookupRequest?: { isbn13: string; id: number };
  /**
   * Se consulta antes de guardar (p. ej. para avisar de un libro duplicado). Con `false` no se guarda y el
   * formulario sigue abierto. Se ejecuta fuera del tiempo máximo de guardado: la persona puede tardar en decidir.
   */
  confirm?: (fields: NewBookFields) => Promise<boolean>;
  /** Guarda los datos validados. Si falla, el formulario muestra el error y sigue abierto. */
  onSubmit: (fields: NewBookFields) => Promise<void>;
  /** Se llama cuando el guardado terminó bien (normalmente, para volver atrás). */
  onSaved: () => void;
}

/** Formulario de libro compartido por «Añadir libro» y «Editar libro». */
export function BookForm({
  initialValues = EMPTY_BOOK_FORM,
  submitLabel,
  acquisition = 'owned',
  showStatus = true,
  seriesSuggestions = NO_SERIES,
  onLookup,
  onScan,
  lookupRequest,
  confirm,
  onSubmit,
  onSaved,
}: BookFormProps) {
  const styles = useStyles();
  const [values, setValues] = useState<BookFormValues>(initialValues);
  const [errors, setErrors] = useState<BookFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [looking, setLooking] = useState(false);
  const [seriesFocused, setSeriesFocused] = useState(false);
  const seriesMatches = useMemo(
    () => getSeriesSuggestions(seriesSuggestions, values.seriesName),
    [seriesSuggestions, values.seriesName],
  );

  const { ref: containerRef, top, onLayout } = useWindowTop();
  const scrollRef = useRef<ScrollView>(null);
  const titleRef = useRef<TextInput>(null);
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

  // Rellena título, autores, páginas y portada con los datos del catálogo. Es una acción explícita, así que
  // sustituye lo que hubiera escrito en esos campos.
  const runLookup = async (isbn13: string) => {
    if (!onLookup || looking) return;
    setErrors((current) => ({ ...current, isbn13: undefined }));
    setLooking(true);
    try {
      const book = await onLookup(isbn13);
      if (!book) {
        setErrors((current) => ({ ...current, isbn13: ISBN_NOT_FOUND_MESSAGE }));
        return;
      }
      setValues((current) => ({
        ...current,
        isbn13: book.isbn13,
        title: book.title,
        authors: book.authors.join(', '),
        pageCount: book.pageCount !== undefined ? String(book.pageCount) : current.pageCount,
        coverUrl: book.coverUrl ?? '',
      }));
      setErrors({});
    } catch (error) {
      setErrors((current) => ({ ...current, isbn13: getCatalogErrorMessage(error) }));
    } finally {
      setLooking(false);
    }
  };

  // Botón «Buscar por ISBN»: valida lo escrito y consulta el catálogo.
  const handleLookup = () => {
    const parsed = parseIsbn(values.isbn13);
    if (!parsed.ok) {
      setErrors((current) => ({ ...current, isbn13: getIsbnErrorMessage(parsed.reason) }));
      return;
    }
    runLookup(parsed.isbn13);
  };

  // Un ISBN recién escaneado se escribe en el campo y se busca solo, una vez por lectura (por `id`).
  const handledRequest = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!lookupRequest || handledRequest.current === lookupRequest.id) return;
    handledRequest.current = lookupRequest.id;
    setValues((current) => ({ ...current, isbn13: lookupRequest.isbn13 }));
    runLookup(lookupRequest.isbn13);
    // Solo debe reaccionar a una petición nueva, no a los cambios de `looking` ni de `onLookup`.
  }, [lookupRequest?.id]);

  const handleSubmit = async () => {
    if (saving) return;

    const result = parseBookForm(values, acquisition);
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
      if (confirm && !(await confirm(result.data))) {
        setSaving(false);
        return;
      }
      await withTimeout(onSubmit(result.data), SAVE_TIMEOUT_MS);
      onSaved();
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
            label="ISBN"
            value={values.isbn13}
            onChangeText={setField('isbn13')}
            error={errors.isbn13}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={ISBN_INPUT_MAX_LENGTH}
            action={onScan ? { icon: 'camera-outline', label: 'Escanear código de barras', onPress: onScan } : undefined}
            returnKeyType={onLookup ? 'search' : 'next'}
            submitBehavior="submit"
            onSubmitEditing={onLookup ? handleLookup : () => titleRef.current?.focus()}
          />
          {onLookup ? (
            <Button
              title="Buscar por ISBN"
              variant="secondary"
              onPress={handleLookup}
              loading={looking}
              disabled={!values.isbn13.trim()}
            />
          ) : null}
          <TextField
            ref={titleRef}
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
            placeholder="Separa varios con coma"
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
            placeholder="Separa varios con coma"
            value={values.genres}
            onChangeText={setField('genres')}
            error={errors.genres}
            autoCapitalize="sentences"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => seriesRef.current?.focus()}
          />
          <View style={styles.suggestGroup}>
            <TextField
              ref={seriesRef}
              label="Saga"
              value={values.seriesName}
              onChangeText={setField('seriesName')}
              onFocus={() => setSeriesFocused(true)}
              onBlur={() => setSeriesFocused(false)}
              error={errors.seriesName}
              maxLength={MAX_SERIES_NAME_LENGTH}
              autoCapitalize="words"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => seriesOrderRef.current?.focus()}
            />
            {/* Sagas ya registradas que coinciden con lo escrito. Solo mientras se escribe en el campo. */}
            {seriesFocused && seriesMatches.length > 0 ? (
              <SuggestionList
                suggestions={seriesMatches}
                accessibilityHint="Usar esta saga"
                onSelect={(name) => setField('seriesName')(name)}
              />
            ) : null}
          </View>
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

          {showStatus && acquisition === 'owned' ? (
            <StatusSelector value={values.status} onChange={setField('status')} error={errors.status} />
          ) : null}

          {submitError ? (
            <Text style={styles.error} accessibilityRole="alert">
              {submitError}
            </Text>
          ) : null}

          <Button title={submitLabel} onPress={handleSubmit} loading={saving} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl * 3 },
  // El campo y sus sugerencias van juntos (más cerca entre sí que del resto de campos).
  suggestGroup: { gap: spacing.xs },
  error: { fontSize: fontSize.sm, fontFamily: fontFamily.regular, color: colors.error },
}));
