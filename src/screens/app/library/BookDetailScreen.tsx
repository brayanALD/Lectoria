import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BookCover } from '../../../components/BookCover';
import { Button } from '../../../components/Button';
import { EmptyState } from '../../../components/EmptyState';
import { BookDetailSkeleton, SessionListSkeleton } from '../../../components/BookSkeletons';
import { ReadingProgress } from '../../../components/ReadingProgress';
import { SessionRow } from '../../../components/SessionRow';
import { StatusSelector } from '../../../components/StatusSelector';
import { useAuth } from '../../../context/AuthContext';
import { useBook } from '../../../hooks/useBook';
import { useBookSessions } from '../../../hooks/useBookSessions';
import { useDeleteSession } from '../../../hooks/useDeleteSession';
import { useReadingStats } from '../../../hooks/useReadingStats';
import type { AppStackParamList } from '../../../navigation/types';
import { changeBookStatus, deleteBook } from '../../../services/booksService';
import { adjustBookProgress } from '../../../services/sessionsService';
import type { ReadingStatus } from '../../../types/book';
import { colors } from '../../../theme/colors';
import { iconSize, opacity, radius, spacing } from '../../../theme/spacing';
import { fontFamily, fontSize } from '../../../theme/typography';
import { getProgressPercent } from '../../../utils/book';
import { formatDayLabel } from '../../../utils/calendar';
import { formatLongDate } from '../../../utils/dateUtils';
import { getFirestoreErrorMessage } from '../../../utils/firestoreErrors';
import { formatTotals } from '../../../utils/readingStats';
import { withTimeout } from '../../../utils/withTimeout';
import { ProgressAdjustSheet } from './ProgressAdjustSheet';

type Props = NativeStackScreenProps<AppStackParamList, 'BookDetail'>;

const COVER_WIDTH = 112;
// Sin conexión, las escrituras de Firestore no terminan hasta recuperar la red: se corta la espera.
const WRITE_TIMEOUT_MS = 10000;
// Eliminar consulta y borra las sesiones del libro en varios lotes: se da más margen.
const DELETE_TIMEOUT_MS = 20000;
// Cuántas lecturas se muestran de golpe en la lista de sesiones del libro.
const SESSIONS_PAGE_SIZE = 10;

export function BookDetailScreen({ navigation, route }: Props) {
  const { user } = useAuth();
  const { book, loading, error, retry } = useBook(route.params.bookId);
  const bookSessions = useBookSessions(route.params.bookId);
  const { todayKey } = useReadingStats();
  const { confirmDelete: confirmDeleteSession, error: sessionError } = useDeleteSession();
  const [visibleSessions, setVisibleSessions] = useState(SESSIONS_PAGE_SIZE);
  const [changingStatus, setChangingStatus] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [adjusting, setAdjusting] = useState(false);

  // Mientras se elimina, el libro desaparece de la lista antes de que termine la operación:
  // se mantiene la silueta de carga para no mostrar «el libro no existe» un instante.
  if (loading || deleting) return <BookDetailSkeleton />;

  if (error && !book) {
    return (
      <EmptyState
        icon="cloud-offline-outline"
        title="No se pudo cargar el libro"
        description={error}
        action={{ label: 'Reintentar', onPress: retry }}
      />
    );
  }

  if (!book) {
    return (
      <EmptyState
        icon="book-outline"
        title="Este libro ya no existe"
        action={{ label: 'Volver', onPress: () => navigation.goBack() }}
      />
    );
  }

  const handleStatusChange = async (next: ReadingStatus) => {
    if (!user || changingStatus || next === book.status) return;
    setActionError(null);
    setChangingStatus(true);
    try {
      await withTimeout(changeBookStatus(user.uid, book, next), WRITE_TIMEOUT_MS);
    } catch (e) {
      setActionError(getFirestoreErrorMessage(e));
    } finally {
      setChangingStatus(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      `¿Eliminar «${book.title}»?`,
      'Se eliminarán también todas sus sesiones de lectura. Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: handleDelete },
      ],
    );
  };

  const handleDelete = async () => {
    if (!user) return;
    setActionError(null);
    setDeleting(true);
    try {
      await withTimeout(deleteBook(user.uid, book.id), DELETE_TIMEOUT_MS);
      navigation.goBack();
    } catch (e) {
      setActionError(getFirestoreErrorMessage(e));
      setDeleting(false);
    }
  };

  const percent = getProgressPercent(book);
  const details: { label: string; value: string }[] = [
    book.genres?.length ? { label: 'Géneros', value: book.genres.join(', ') } : undefined,
    book.seriesName
      ? { label: 'Saga', value: `${book.seriesName}${book.seriesOrder !== undefined ? ` #${book.seriesOrder}` : ''}` }
      : undefined,
    book.startedAt ? { label: 'Empezado', value: formatLongDate(book.startedAt) } : undefined,
    book.finishedAt ? { label: 'Terminado', value: formatLongDate(book.finishedAt) } : undefined,
  ].filter((row): row is { label: string; value: string } => row !== undefined);

  return (
    <>
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <BookCover title={book.title} coverUrl={book.coverUrl} width={COVER_WIDTH} />
        <View style={styles.headerText}>
          <Text style={styles.title} accessibilityRole="header">
            {book.title}
          </Text>
          <Text style={styles.authors}>{book.authors.join(', ')}</Text>
        </View>
      </View>

      {/* Las etiquetas de estado se explican solas; el nombre del grupo se conserva para el lector de pantalla. */}
      <StatusSelector showLabel={false} value={book.status} onChange={handleStatusChange} />

      {/* Tocar el progreso permite ajustar la página a mano. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Página ${book.currentPage}${book.pageCount ? ` de ${book.pageCount}` : ''}`}
        accessibilityHint="Toca para cambiar la página actual"
        onPress={() => setAdjusting(true)}
        style={({ pressed }) => [styles.section, pressed && styles.pressed]}
      >
        <View style={styles.progressRow}>
          <Text style={styles.progressText}>
            Página {book.currentPage}
            {book.pageCount ? ` de ${book.pageCount}` : ''}
          </Text>
          <Ionicons name="create-outline" size={iconSize.md} color={colors.primary} />
        </View>
        {percent !== undefined ? <ReadingProgress percent={percent} /> : null}
      </Pressable>

      {details.length > 0 ? (
        <View style={styles.section}>
          {details.map((row) => (
            <View key={row.label} style={styles.row}>
              <Text style={styles.rowLabel}>{row.label}</Text>
              <Text style={styles.rowValue}>{row.value}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {(actionError ?? sessionError) ? (
        <Text style={styles.error} accessibilityRole="alert">
          {actionError ?? sessionError}
        </Text>
      ) : null}

      <Button title="Registrar lectura" onPress={() => navigation.navigate('AddSession', { bookId: book.id })} />

      {/* Las lecturas de este libro, derivadas de la misma lista de sesiones que usan Inicio y el Calendario. */}
      {bookSessions.loading ? (
        <SessionListSkeleton />
      ) : bookSessions.sessions.length > 0 ? (
        <View style={styles.sessions}>
          <Text style={styles.heading} accessibilityRole="header">
            Lecturas
          </Text>
          <Text style={styles.sessionsSummary}>
            {formatTotals(bookSessions.totals)} · {bookSessions.totals.sessions}{' '}
            {bookSessions.totals.sessions === 1 ? 'sesión' : 'sesiones'}
          </Text>
          {bookSessions.sessions.slice(0, visibleSessions).map((session) => (
            <SessionRow
              key={session.id}
              title={formatDayLabel(session.dateKey, todayKey)}
              detail={formatTotals({ minutes: session.durationMinutes, pages: session.pagesRead })}
              notes={session.notes}
              onEdit={() => navigation.navigate('AddSession', { sessionId: session.id })}
              onDelete={() => confirmDeleteSession(session)}
            />
          ))}
          {bookSessions.sessions.length > visibleSessions ? (
            <Button
              title="Mostrar más"
              variant="secondary"
              onPress={() => setVisibleSessions((count) => count + SESSIONS_PAGE_SIZE)}
            />
          ) : null}
        </View>
      ) : null}

      <View style={styles.actions}>
        <Button title="Editar" variant="secondary" onPress={() => navigation.navigate('EditBook', { bookId: book.id })} />
        <Button title="Eliminar" variant="danger" onPress={confirmDelete} />
      </View>
    </ScrollView>

    <ProgressAdjustSheet
      visible={adjusting}
      onClose={() => setAdjusting(false)}
      book={book}
      onSave={async (page) => {
        if (!user) throw new Error('No hay sesión iniciada');
        await withTimeout(adjustBookProgress(user.uid, book, page), WRITE_TIMEOUT_MS);
      }}
    />
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl * 2 },
  header: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  headerText: { flex: 1, gap: spacing.xs },
  title: { fontSize: fontSize.xl, fontFamily: fontFamily.displayBold, color: colors.textPrimary },
  authors: { fontSize: fontSize.md, fontFamily: fontFamily.regular, color: colors.textSecondary },
  section: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceTint },
  progressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressText: { fontSize: fontSize.md, fontFamily: fontFamily.regular, color: colors.textPrimary },
  pressed: { opacity: opacity.pressed },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  rowLabel: { fontSize: fontSize.md, fontFamily: fontFamily.regular, color: colors.textSecondary },
  rowValue: { flex: 1, fontSize: fontSize.md, fontFamily: fontFamily.regular, color: colors.textPrimary, textAlign: 'right' },
  error: { fontSize: fontSize.sm, fontFamily: fontFamily.regular, color: colors.error },
  sessions: { gap: spacing.sm },
  heading: { fontSize: fontSize.lg, fontFamily: fontFamily.display, color: colors.textPrimary },
  sessionsSummary: { fontSize: fontSize.md, fontFamily: fontFamily.regular, color: colors.textSecondary },
  actions: { gap: spacing.md },
});
