import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo } from 'react';

import { BookCardList } from '../../../components/BookCardList';
import { EmptyState } from '../../../components/EmptyState';
import { EntityHeader } from '../../../components/EntityHeader';
import { BookListSkeleton } from '../../../components/ListSkeletons';
import { useBooks } from '../../../hooks/useBooks';
import type { AppStackParamList } from '../../../navigation/types';
import { describeAuthor, getAuthorBooks, summarizeAuthors } from '../../../utils/authors';
import { normalizeText } from '../../../utils/bookFilters';

type Props = NativeStackScreenProps<AppStackParamList, 'AuthorDetail'>;

/** Los libros de un autor (propios y deseos) con cuántos hay y cuántos están terminados. */
export function AuthorDetailScreen({ navigation, route }: Props) {
  const { name } = route.params;
  const { books, loading, error, retry } = useBooks();
  const authorBooks = useMemo(() => getAuthorBooks(books, name), [books, name]);
  // El nombre visible es la grafía más repetida; el que llega por la ruta solo identifica al autor.
  const summary = useMemo(
    () => summarizeAuthors(authorBooks).find((author) => normalizeText(author.name) === normalizeText(name)),
    [authorBooks, name],
  );

  if (loading) return <BookListSkeleton label="Cargando autor" />;

  if (error && books.length === 0) {
    return (
      <EmptyState
        icon="cloud-offline-outline"
        title="No se pudo cargar tu biblioteca"
        description={error}
        action={{ label: 'Reintentar', onPress: retry }}
      />
    );
  }

  if (!summary) {
    return <EmptyState icon="person-outline" title="Este autor ya no tiene libros" action={{ label: 'Volver', onPress: () => navigation.goBack() }} />;
  }

  return (
    <BookCardList
      books={authorBooks}
      header={<EntityHeader title={summary.name} lines={[describeAuthor(summary)]} />}
      onOpenBook={(book) => navigation.navigate('BookDetail', { bookId: book.id })}
    />
  );
}
