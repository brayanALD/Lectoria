import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { BookCardList } from '../../../components/BookCardList';
import { Button } from '../../../components/Button';
import { EmptyState } from '../../../components/EmptyState';
import { EntityHeader } from '../../../components/EntityHeader';
import { BookListSkeleton } from '../../../components/ListSkeletons';
import { useAuth } from '../../../context/AuthContext';
import { makeStyles } from '../../../context/ThemeContext';
import { useBooks } from '../../../hooks/useBooks';
import { useCollection } from '../../../hooks/useCollections';
import type { AppStackParamList } from '../../../navigation/types';
import { deleteCollection } from '../../../services/collectionsService';
import { spacing } from '../../../theme/spacing';
import { fontFamily, fontSize } from '../../../theme/typography';
import { formatBookCount } from '../../../utils/book';
import { countMissingBooks, describeFilters, resolveCollectionBooks } from '../../../utils/collections';
import { getFirestoreErrorMessage } from '../../../utils/firestoreErrors';
import { withTimeout } from '../../../utils/withTimeout';

type Props = NativeStackScreenProps<AppStackParamList, 'CollectionDetail'>;

const DELETE_TIMEOUT_MS = 10000;

/**
 * Una colección o estantería: sus libros (en una estantería, los que cumplen sus filtros ahora mismo), editarla y
 * eliminarla. Eliminarla no toca los libros.
 */
export function CollectionDetailScreen({ navigation, route }: Props) {
  const styles = useStyles();
  const { user } = useAuth();
  const { collection, loading, error, retry } = useCollection(route.params.collectionId);
  const { books, loading: booksLoading } = useBooks();
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const collectionBooks = useMemo(() => (collection ? resolveCollectionBooks(collection, books) : []), [collection, books]);
  const missing = collection ? countMissingBooks(collection, books) : 0;

  // Mientras se elimina, la colección desaparece de la lista antes de que termine: se mantiene la silueta de carga
  // para no mostrar «ya no existe» un instante.
  if (loading || booksLoading || deleting) return <BookListSkeleton label="Cargando colección" />;

  if (error && !collection) {
    return (
      <EmptyState
        icon="cloud-offline-outline"
        title="No se pudo cargar la colección"
        description={error}
        action={{ label: 'Reintentar', onPress: retry }}
      />
    );
  }

  if (!collection) {
    return <EmptyState icon="albums-outline" title="Esta colección ya no existe" action={{ label: 'Volver', onPress: () => navigation.goBack() }} />;
  }

  const isShelf = collection.kind === 'filter';

  const handleDelete = async () => {
    if (!user) return;
    setActionError(null);
    setDeleting(true);
    try {
      await withTimeout(deleteCollection(user.uid, collection.id), DELETE_TIMEOUT_MS);
      navigation.goBack();
    } catch (e) {
      setActionError(getFirestoreErrorMessage(e));
      setDeleting(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      `¿Eliminar «${collection.name}»?`,
      isShelf ? 'Tus libros no se tocan. Esta acción no se puede deshacer.' : 'Solo se elimina la colección: tus libros no se tocan.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: handleDelete },
      ],
    );
  };

  const openForm = () => navigation.navigate('CollectionForm', { collectionId: collection.id });

  return (
    <BookCardList
      books={collectionBooks}
      header={
        <EntityHeader
          title={collection.name}
          lines={[
            isShelf && collection.filters ? describeFilters(collection.filters) : undefined,
            formatBookCount(collectionBooks.length),
            missing > 0
              ? `${missing} ${missing === 1 ? 'libro ya no está' : 'libros ya no están'} en tu biblioteca y se ${missing === 1 ? 'ignora' : 'ignoran'}`
              : undefined,
          ]}
        >
          <View style={styles.actions}>
            <Button title="Editar" variant="secondary" onPress={openForm} />
            <Button title="Eliminar" variant="danger" onPress={confirmDelete} />
          </View>
          {actionError ? (
            <Text style={styles.error} accessibilityRole="alert">
              {actionError}
            </Text>
          ) : null}
        </EntityHeader>
      }
      empty={
        isShelf ? (
          <EmptyState icon="funnel-outline" title="Ningún libro cumple estos filtros" />
        ) : (
          <EmptyState icon="albums-outline" title="Esta colección está vacía" action={{ label: 'Añadir libros', onPress: openForm }} />
        )
      }
      onOpenBook={(book) => navigation.navigate('BookDetail', { bookId: book.id })}
    />
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  actions: { gap: spacing.sm, marginTop: spacing.sm },
  error: { fontSize: fontSize.sm, fontFamily: fontFamily.regular, color: colors.error },
}));
