import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo } from 'react';

import { BookForm } from '../../../components/BookForm';
import { EmptyState } from '../../../components/EmptyState';
import { BookFormSkeleton } from '../../../components/BookSkeletons';
import { useAuth } from '../../../context/AuthContext';
import { useBook } from '../../../hooks/useBook';
import type { AppStackParamList } from '../../../navigation/types';
import { updateBookDetails } from '../../../services/booksService';
import { bookToFormValues } from '../../../utils/book';
import { getFilterOptions } from '../../../utils/bookFilters';

type Props = NativeStackScreenProps<AppStackParamList, 'EditBook'>;

export function EditBookScreen({ navigation, route }: Props) {
  const { user } = useAuth();
  const { book, books, loading, error, retry } = useBook(route.params.bookId);
  const seriesNames = useMemo(() => getFilterOptions(books).series, [books]);

  if (loading) return <BookFormSkeleton />;

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

  return (
    <BookForm
      initialValues={bookToFormValues(book)}
      submitLabel="Guardar cambios"
      seriesSuggestions={seriesNames}
      // El estado se cambia desde el detalle: aquí solo se editan los datos del libro.
      showStatus={false}
      onSubmit={async (fields) => {
        if (!user) throw new Error('No hay sesión iniciada');
        await updateBookDetails(user.uid, book, fields);
      }}
      onSaved={() => navigation.goBack()}
    />
  );
}
