import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo } from 'react';

import { EmptyState } from '../../../components/EmptyState';
import { RowListSkeleton } from '../../../components/ListSkeletons';
import { NavRowList } from '../../../components/NavRowList';
import { useBooks } from '../../../hooks/useBooks';
import type { AppStackParamList } from '../../../navigation/types';
import { describeAuthor, summarizeAuthors } from '../../../utils/authors';

type Props = NativeStackScreenProps<AppStackParamList, 'Authors'>;

/** Los autores de la biblioteca (derivados de los libros, propios y deseos); tocar uno abre su detalle. */
export function AuthorsScreen({ navigation }: Props) {
  const { books, loading, error, retry } = useBooks();
  const authors = useMemo(() => summarizeAuthors(books), [books]);

  if (loading) return <RowListSkeleton label="Cargando autores" />;

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

  if (authors.length === 0) return <EmptyState icon="person-outline" title="Aún no hay autores" />;

  return (
    <NavRowList
      items={authors.map((author) => ({ id: author.name, title: author.name, subtitle: describeAuthor(author) }))}
      onOpen={(name) => navigation.navigate('AuthorDetail', { name })}
    />
  );
}
