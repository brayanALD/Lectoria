import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { BookFormSkeleton } from '../../../components/BookSkeletons';
import { BookPickerSheet } from '../../../components/BookPickerSheet';
import { Button } from '../../../components/Button';
import { DatePickerSheet } from '../../../components/DatePickerSheet';
import { EmptyState } from '../../../components/EmptyState';
import { PickerRow } from '../../../components/PickerRow';
import { TextField } from '../../../components/TextField';
import { useAuth } from '../../../context/AuthContext';
import { useReadingTimer } from '../../../context/ReadingTimerContext';
import { useBooks } from '../../../hooks/useBooks';
import { useReadingStats } from '../../../hooks/useReadingStats';
import { useSessions } from '../../../hooks/useSessions';
import { useWindowTop } from '../../../hooks/useWindowTop';
import type { AppStackParamList } from '../../../navigation/types';
import { createSession, updateSession } from '../../../services/sessionsService';
import type { UserBookWithId } from '../../../types/book';
import type { ReadingSessionWithId, SessionFormErrors } from '../../../types/session';
import { colors } from '../../../theme/colors';
import { minTouchSize, spacing } from '../../../theme/spacing';
import { fontSize } from '../../../theme/typography';
import { dateForDay, formatDayLabel, resolveDayKey } from '../../../utils/calendar';
import { getFirestoreErrorMessage } from '../../../utils/firestoreErrors';
import { buildTimerDraft, type TimerDraft } from '../../../utils/readingTimer';
import { MAX_SESSION_NOTES, parseSessionForm, toDateKey } from '../../../utils/session';
import { pickDefaultBook } from '../../../utils/sessionBooks';
import { withTimeout } from '../../../utils/withTimeout';

type Props = NativeStackScreenProps<AppStackParamList, 'AddSession'>;

// Sin conexión, una escritura de Firestore no termina hasta recuperar la red: se corta la espera.
const SAVE_TIMEOUT_MS = 10000;
const MAX_DIGITS = 6;

/**
 * Registrar una lectura, editar una ya registrada (`sessionId`), registrarla desde un día elegido en el Calendario
 * (`day`) o registrar la que midió el cronómetro (`fromTimer`). Esta pantalla solo resuelve los datos (libros,
 * sesiones y cronómetro vienen de sus fuentes únicas); el formulario es `SessionForm`.
 */
export function AddSessionScreen({ navigation, route }: Props) {
  const { books, loading: booksLoading } = useBooks();
  const { sessions, loading: sessionsLoading } = useSessions();
  const { timer, loading: timerLoading } = useReadingTimer();

  const { sessionId, fromTimer, day, bookId } = route.params ?? {};
  const editing = sessionId ? sessions.find((candidate) => candidate.id === sessionId) : undefined;

  // El borrador del cronómetro se toma UNA vez, al abrir el formulario: al guardar se descarta el cronómetro y el
  // formulario no debe cambiar ni desaparecer mientras la pantalla se cierra.
  const [draft, setDraft] = useState<TimerDraft | undefined>();
  useEffect(() => {
    if (fromTimer && !draft && !timerLoading && timer) setDraft(buildTimerDraft(timer, Date.now()));
  }, [fromTimer, draft, timerLoading, timer]);

  if (booksLoading || (sessionId && sessionsLoading) || (fromTimer && (timerLoading || (timer && !draft)))) {
    return <BookFormSkeleton />;
  }

  if (sessionId && !editing) {
    return (
      <EmptyState
        icon="book-outline"
        title="Esta lectura ya no existe"
        action={{ label: 'Volver', onPress: () => navigation.goBack() }}
      />
    );
  }

  if (fromTimer && !draft) {
    return (
      <EmptyState
        icon="timer-outline"
        title="El cronómetro ya no está activo"
        action={{ label: 'Volver', onPress: () => navigation.goBack() }}
      />
    );
  }

  // `key`: cada sesión editada parte de sus propios valores.
  return (
    <SessionForm
      key={editing?.id ?? draft?.sessionId ?? 'new'}
      navigation={navigation}
      books={books}
      sessions={sessions}
      fixedBookId={editing?.bookId ?? draft?.bookId ?? bookId}
      editing={editing}
      draft={draft}
      day={day}
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
  /** Lo que midió el cronómetro: libro, minutos y día de inicio. Al guardar, el cronómetro se descarta. */
  draft?: TimerDraft;
  /** Día preseleccionado (p. ej. el elegido en el Calendario); un día futuro se ignora. */
  day?: string;
}

function SessionForm({ navigation, books, sessions, fixedBookId, editing, draft, day }: SessionFormProps) {
  const { user } = useAuth();
  const { discard } = useReadingTimer();
  const { readingDays, todayKey } = useReadingStats();

  const [chosenId, setChosenId] = useState<string | undefined>();
  const book = useMemo(() => {
    const id = fixedBookId ?? chosenId;
    return (id ? books.find((candidate) => candidate.id === id) : undefined) ?? (fixedBookId ? undefined : pickDefaultBook(books));
  }, [books, fixedBookId, chosenId]);

  // Un día elegido se respeta tal cual (una lectura pasada es una sesión histórica); solo se corrige un día futuro.
  const [dayKey, setDayKey] = useState(editing?.dateKey ?? draft?.dayKey ?? resolveDayKey(day, todayKey));

  const [minutes, setMinutes] = useState(editing?.durationMinutes ? String(editing.durationMinutes) : (draft?.minutes ?? ''));
  const [startPage, setStartPage] = useState(editing?.startPage !== undefined ? String(editing.startPage) : '');
  const [endPage, setEndPage] = useState(editing?.endPage !== undefined ? String(editing.endPage) : '');
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [errors, setErrors] = useState<SessionFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [bookSheet, setBookSheet] = useState(false);
  const [dateSheet, setDateSheet] = useState(false);

  const { ref: containerRef, top, onLayout } = useWindowTop();
  const scrollRef = useRef<ScrollView>(null);
  const startRef = useRef<TextInput>(null);
  const pageRef = useRef<TextInput>(null);
  const notesRef = useRef<TextInput>(null);

  // La página actual del libro solo sirve de «página inicial» para lo que se lee ahora. Al registrar una lectura de otro
  // día o al editar una sesión con página inicial, ya no dice dónde se empezó: entonces se pide, y es obligatoria si hay
  // página final. Para lo de hoy el campo no aparece y se parte de la página actual, como siempre.
  const showStartPage = dayKey < todayKey || editing?.startPage !== undefined;

  if (!book) {
    // Con libro fijo (detalle, edición o cronómetro) es que se eliminó; sin él, que no hay ninguno.
    return fixedBookId ? (
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

    // Esa lectura del cronómetro ya está guardada (p. ej. un guardado anterior tardó en confirmarse): no se repite.
    if (draft && sessions.some((candidate) => candidate.id === draft.sessionId)) {
      discard();
      navigation.goBack();
      return;
    }

    const now = new Date();
    // Al editar sin cambiar el día se conserva la hora original; con otro día se aplica la misma regla que al crear.
    const date = editing && dayKey === editing.dateKey ? editing.date.toDate() : dateForDay(dayKey, now, toDateKey(now));
    // Sin página final no hay páginas que contar: una inicial suelta no se tiene en cuenta.
    const startText = showStartPage && endPage.trim() ? startPage : '';
    const result = parseSessionForm(
      { date, minutes, startPage: startText, endPage, notes },
      book.id,
      book,
      now,
      undefined,
      showStartPage,
    );
    if (!result.ok) {
      // Con el cronómetro los minutos no se pueden editar: si no llegó a medio minuto, solo queda indicar la página.
      const generalError =
        draft && !minutes && result.errors.general
          ? 'Con menos de medio minuto no hay minutos que registrar. Indica la página en la que vas.'
          : result.errors.general;
      setErrors({ ...result.errors, general: generalError });
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
        : createSession(user.uid, book, result.data, undefined, draft?.sessionId).then(() => undefined);
      await withTimeout(save, SAVE_TIMEOUT_MS);
      if (draft) discard();
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
            // Con el cronómetro, los minutos son los que se midieron: no se pueden cambiar.
            editable={!draft}
            error={errors.minutes}
            keyboardType="number-pad"
            maxLength={MAX_DIGITS}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => (showStartPage ? startRef : pageRef).current?.focus()}
          />
          {showStartPage ? (
            <TextField
              ref={startRef}
              label="Página inicial"
              value={startPage}
              onChangeText={edit('startPage', setStartPage)}
              error={errors.startPage}
              keyboardType="number-pad"
              maxLength={MAX_DIGITS}
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => pageRef.current?.focus()}
            />
          ) : null}
          <TextField
            ref={pageRef}
            label={showStartPage ? 'Página final' : 'Página en la que vas'}
            placeholder={showStartPage ? undefined : `Ahora: ${book.currentPage}`}
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

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl * 3 },
  notes: { minHeight: minTouchSize * 2, textAlignVertical: 'top', paddingTop: spacing.sm },
  error: { fontSize: fontSize.sm, color: colors.error },
});
