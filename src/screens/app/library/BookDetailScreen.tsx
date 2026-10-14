import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BookCover } from '../../../components/BookCover';
import { Button } from '../../../components/Button';
import { EmptyState } from '../../../components/EmptyState';
import { BookDetailSkeleton } from '../../../components/BookSkeletons';
import { ReadingProgress } from '../../../components/ReadingProgress';
import { StatusSelector } from '../../../components/StatusSelector';
import { useAuth } from '../../../context/AuthContext';
import { useBook } from '../../../hooks/useBook';
import type { AppStackParamList } from '../../../navigation/types';
import { changeBookStatus, deleteBook } from '../../../services/booksService';
import type { ReadingStatus } from '../../../types/book';
import { colors } from '../../../theme/colors';
import { spacing } from '../../../theme/spacing';
import { fontSize, fontWeight } from '../../../theme/typography';
import { getProgressPercent } from '../../../utils/book';
import { formatLongDate } from '../../../utils/dateUtils';
import { getFirestoreErrorMessage } from '../../../utils/firestoreErrors';
import { withTimeout } from '../../../utils/withTimeout';

type Props = NativeStackScreenProps<AppStackParamList, 'BookDetail'>;

const COVER_WIDTH = 112;
// Sin conexión, las escrituras de Firestore no terminan hasta recuperar la red: se corta la espera.
const WRITE_TIMEOUT_MS = 10000;
// Eliminar consulta y borra las sesiones del libro en varios lotes: se da más margen.
const DELETE_TIMEOUT_MS = 20000;

export function BookDetailScreen({ navigation, route }: Props) {
  const { user } = useAuth();
  const { book, loading, error, retry } = useBook(route.params.bookId);
  const [changingStatus, setChangingStatus] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

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

      <View style={styles.section}>
        <Text style={styles.progressText}>
          Página {book.currentPage}
          {book.pageCount ? ` de ${book.pageCount}` : ''}
        </Text>
        {percent !== undefined ? <ReadingProgress percent={percent} /> : null}
      </View>

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

      {actionError ? (
        <Text style={styles.error} accessibilityRole="alert">
          {actionError}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <Button title="Registrar lectura" onPress={() => navigation.navigate('AddSession', { bookId: book.id })} />
        <Button title="Editar" variant="secondary" onPress={() => navigation.navigate('EditBook', { bookId: book.id })} />
        <Button title="Eliminar" variant="danger" onPress={confirmDelete} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl * 2 },
  header: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  headerText: { flex: 1, gap: spacing.xs },
  title: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.textPrimary },
  authors: { fontSize: fontSize.md, color: colors.textSecondary },
  section: { gap: spacing.sm },
  progressText: { fontSize: fontSize.md, color: colors.textPrimary },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  rowLabel: { fontSize: fontSize.md, color: colors.textSecondary },
  rowValue: { flex: 1, fontSize: fontSize.md, color: colors.textPrimary, textAlign: 'right' },
  error: { fontSize: fontSize.sm, color: colors.error },
  actions: { gap: spacing.md },
});
