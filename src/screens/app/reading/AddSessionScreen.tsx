import { Ionicons } from '@expo/vector-icons';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { BookFormSkeleton } from '../../../components/BookSkeletons';
import { BookPickerSheet } from '../../../components/BookPickerSheet';
import { Button } from '../../../components/Button';
import { DatePickerSheet } from '../../../components/DatePickerSheet';
import { EmptyState } from '../../../components/EmptyState';
import { TextField } from '../../../components/TextField';
import { useAuth } from '../../../context/AuthContext';
import { useBooks } from '../../../hooks/useBooks';
import { useReadingStats } from '../../../hooks/useReadingStats';
import { useSessions } from '../../../hooks/useSessions';
import { useWindowTop } from '../../../hooks/useWindowTop';
import type { AppStackParamList } from '../../../navigation/types';
import { createSession, updateSession } from '../../../services/sessionsService';
import type { UserBookWithId } from '../../../types/book';
import type { ReadingSessionWithId, SessionFormErrors } from '../../../types/session';
import { colors } from '../../../theme/colors';
import { iconSize, minTouchSize, opacity, radius, spacing } from '../../../theme/spacing';
import { fontSize, fontWeight } from '../../../theme/typography';
import { dateForDay, formatDayLabel } from '../../../utils/calendar';
import { getFirestoreErrorMessage } from '../../../utils/firestoreErrors';
import { MAX_SESSION_NOTES, parseSessionForm, toDateKey } from '../../../utils/session';
import { pickDefaultBook } from '../../../utils/sessionBooks';
import { withTimeout } from '../../../utils/withTimeout';

type Props = NativeStackScreenProps<AppStackParamList, 'AddSession'>;

// Sin conexión, una escritura de Firestore no termina hasta recuperar la red: se corta la espera.
const SAVE_TIMEOUT_MS = 10000;
const MAX_DIGITS = 6;

/**
 * Registrar una lectura o, con `sessionId`, editar una ya registrada. Esta pantalla solo resuelve los datos
 * (libros y sesiones vienen de la fuente única de `ReadingDataProvider`); el formulario es `SessionForm`.
 */
export function AddSessionScreen({ navigation, route }: Props) {
  const { books, loading: booksLoading } = useBooks();
  const { sessions, loading: sessionsLoading } = useSessions();

  const sessionId = route.params?.sessionId;
  const editing = sessionId ? sessions.find((candidate) => candidate.id === sessionId) : undefined;

  if (booksLoading || (sessionId && sessionsLoading)) return <BookFormSkeleton />;

  if (sessionId && !editing) {
    return (
      <EmptyState
        icon="book-outline"
        title="Esta lectura ya no existe"
        action={{ label: 'Volver', onPress: () => navigation.goBack() }}
      />
    );
  }

  // `key`: cada sesión editada parte de sus propios valores.
  return (
    <SessionForm
      key={editing?.id ?? 'new'}
      navigation={navigation}
      books={books}
      sessions={sessions}
      fixedBookId={editing?.bookId ?? route.params?.bookId}
      editing={editing}
    />
  );
}

interface SessionFormProps {
  navigation: NativeStackNavigationProp<AppStackParamList, 'AddSession'>;
  books: UserBookWithId[];
  sessions: ReadingSessionWithId[];
  /** Libro fijo (desde su detalle o al editar). Sin él (desde Inicio) se preselecciona uno y se puede cambiar. */
  fixedBookId?: string;
  /** Sesión que se edita; sin ella se registra una nueva. */
  editing?: ReadingSessionWithId;
}

function SessionForm({ navigation, books, sessions, fixedBookId, editing }: SessionFormProps) {
  const { user } = useAuth();
  const { readingDays } = useReadingStats();

  const [chosenId, setChosenId] = useState<string | undefined>();
  const book = useMemo(() => {
    const id = fixedBookId ?? chosenId;
    return (id ? books.find((candidate) => candidate.id === id) : undefined) ?? (fixedBookId ? undefined : pickDefaultBook(books));
  }, [books, fixedBookId, chosenId]);

  const todayKey = toDateKey(new Date());
  const [dayKey, setDayKey] = useState(editing?.dateKey ?? todayKey);

  const [minutes, setMinutes] = useState(editing?.durationMinutes ? String(editing.durationMinutes) : '');
  const [endPage, setEndPage] = useState(editing?.endPage !== undefined ? String(editing.endPage) : '');
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [errors, setErrors] = useState<SessionFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [bookSheet, setBookSheet] = useState(false);
  const [dateSheet, setDateSheet] = useState(false);

  const { ref: containerRef, top, onLayout } = useWindowTop();
  const scrollRef = useRef<ScrollView>(null);
  const pageRef = useRef<TextInput>(null);
  const notesRef = useRef<TextInput>(null);

  if (!book) {
    return editing ? (
      <EmptyState
        icon="book-outline"
        title="Este libro ya no existe"
        action={{ label: 'Volver', onPress: () => navigation.goBack() }}
      />
    ) : (
      <EmptyState
        icon="library-outline"
        title="Añade un libro para registrar lecturas"
        action={{ label: 'Añadir libro', onPress: () => navigation.replace('AddBook') }}
      />
    );
  }

  // Editar un campo limpia su error y el aviso general, para que se vea que ya está corregido.
  const edit = (field: keyof SessionFormErrors, set: (value: string) => void) => (value: string) => {
    set(value);
    setErrors((current) => (current[field] || current.general ? { ...current, [field]: undefined, general: undefined } : current));
  };

  const handleSubmit = async () => {
    if (saving || !user) return;

    const now = new Date();
    // Al editar sin cambiar el día se conserva la hora original; con otro día se aplica la misma regla que al crear.
    const date = editing && dayKey === editing.dateKey ? editing.date.toDate() : dateForDay(dayKey, now, toDateKey(now));
    // Al editar, las páginas leídas se calculan desde la página inicial original (si aún se indica página final).
    const startPage = editing?.startPage !== undefined && endPage.trim() ? String(editing.startPage) : '';
    const result = parseSessionForm({ date, minutes, startPage, endPage, notes }, book.id, book, now);
    if (!result.ok) {
      setErrors(result.errors);
      setSubmitError(null);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }

    setErrors({});
    setSubmitError(null);
    setSaving(true);
    try {
      const save = editing
        ? updateSession(user.uid, editing, { ...result.data, dateKey: dayKey }, book, sessions)
        : createSession(user.uid, book, result.data).then(() => undefined);
      await withTimeout(save, SAVE_TIMEOUT_MS);
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
          <PickerRow
            label="Libro"
            value={book.title}
            icon="chevron-down"
            onPress={fixedBookId ? undefined : () => setBookSheet(true)}
          />
          <PickerRow
            label="Fecha"
            value={formatDayLabel(dayKey, todayKey)}
            icon="calendar-outline"
            onPress={() => setDateSheet(true)}
            error={errors.date}
          />
          <TextField
            label="Minutos leídos"
            value={minutes}
            onChangeText={edit('minutes', setMinutes)}
            error={errors.minutes}
            keyboardType="number-pad"
            maxLength={MAX_DIGITS}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => pageRef.current?.focus()}
          />
          <TextField
            ref={pageRef}
            label="Página en la que vas"
            placeholder={`Ahora: ${book.currentPage}`}
            value={endPage}
            onChangeText={edit('endPage', setEndPage)}
            error={errors.endPage}
            keyboardType="number-pad"
            maxLength={MAX_DIGITS}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => notesRef.current?.focus()}
          />
          <TextField
            ref={notesRef}
            label="Notas"
            value={notes}
            onChangeText={edit('notes', setNotes)}
            error={errors.notes}
            maxLength={MAX_SESSION_NOTES}
            multiline
            style={styles.notes}
          />

          {errors.general ? (
            <Text style={styles.error} accessibilityRole="alert">
              {errors.general}
            </Text>
          ) : null}
          {submitError ? (
            <Text style={styles.error} accessibilityRole="alert">
              {submitError}
            </Text>
          ) : null}

          <Button title="Guardar" onPress={handleSubmit} loading={saving} />
        </ScrollView>
      </KeyboardAvoidingView>

      <BookPickerSheet
        visible={bookSheet}
        onClose={() => setBookSheet(false)}
        books={books}
        selectedId={book.id}
        onPick={(picked) => {
          setChosenId(picked.id);
          setErrors({});
        }}
      />
      <DatePickerSheet
        visible={dateSheet}
        onClose={() => setDateSheet(false)}
        selectedKey={dayKey}
        todayKey={todayKey}
        markedDays={readingDays}
        onPick={(picked) => {
          setDayKey(picked);
          setErrors((current) => ({ ...current, date: undefined }));
        }}
      />
    </View>
  );
}

interface PickerRowProps {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Sin `onPress` la fila solo informa (p. ej. el libro fijo al venir desde su detalle). */
  onPress?: () => void;
  error?: string;
}

// Campo que se elige en una hoja en lugar de escribirse; se ve igual que un `TextField`.
function PickerRow({ label, value, icon, onPress, error }: PickerRowProps) {
  const body = (
    <View style={[styles.field, error ? styles.fieldError : null]}>
      <Text style={styles.fieldValue} numberOfLines={1}>
        {value}
      </Text>
      {onPress ? <Ionicons name={icon} size={iconSize.md} color={colors.primary} /> : null}
    </View>
  );

  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      {onPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${value}`}
          accessibilityHint="Toca para cambiar"
          onPress={onPress}
          style={({ pressed }) => pressed && styles.pressed}
        >
          {body}
        </Pressable>
      ) : (
        <View accessible accessibilityLabel={`${label}: ${value}`}>
          {body}
        </View>
      )}
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl * 3 },
  group: { gap: spacing.xs },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    minHeight: minTouchSize,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  fieldError: { borderColor: colors.error },
  fieldValue: { flex: 1, fontSize: fontSize.md, color: colors.textPrimary },
  pressed: { opacity: opacity.pressed },
  notes: { minHeight: minTouchSize * 2, textAlignVertical: 'top', paddingTop: spacing.sm },
  error: { fontSize: fontSize.sm, color: colors.error },
});
