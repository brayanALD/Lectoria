import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo } from 'react';

import { BookCardList } from '../../../components/BookCardList';
import { EmptyState } from '../../../components/EmptyState';
import { EntityHeader } from '../../../components/EntityHeader';
import { BookListSkeleton } from '../../../components/ListSkeletons';
import { NavRow } from '../../../components/NavRow';
import { ReadingProgress } from '../../../components/ReadingProgress';
import { useBooks } from '../../../hooks/useBooks';
import type { AppStackParamList } from '../../../navigation/types';
import { normalizeText } from '../../../utils/bookFilters';
import {
  describeMissingNumbers,
  describeSeries,
  getNextToRead,
  getSeriesBooks,
  summarizeSeries,
} from '../../../utils/series';

type Props = NativeStackScreenProps<AppStackParamList, 'SeriesDetail'>;

/**
 * Una saga: sus libros en orden, cuántos están terminados de los registrados (el total real de la saga no se conoce), el
 * siguiente por leer y los números que faltan.
 */
export function SeriesDetailScreen({ navigation, route }: Props) {
  const { name } = route.params;
  const { books, loading, error, retry } = useBooks();
  const ordered = useMemo(() => getSeriesBooks(books, name), [books, name]);
  const summary = useMemo(
    () => summarizeSeries(ordered).find((saga) => normalizeText(saga.name) === normalizeText(name)),
    [ordered, name],
  );
  const next = useMemo(() => getNextToRead(ordered), [ordered]);

  if (loading) return <BookListSkeleton label="Cargando saga" />;

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
    return <EmptyState icon="layers-outline" title="Esta saga ya no tiene libros" action={{ label: 'Volver', onPress: () => navigation.goBack() }} />;
  }

  const openBook = (bookId: string) => navigation.navigate('BookDetail', { bookId });
  const progress = describeSeries(summary);

  return (
    <BookCardList
      books={ordered}
      header={
        <EntityHeader title={summary.name} lines={[progress, describeMissingNumbers(summary.missing)]}>
          <ReadingProgress
            percent={Math.round((summary.finished / summary.books) * 100)}
            showLabel={false}
            accessibilityLabel="Avance de la saga"
            valueText={progress}
          />
          {next ? <NavRow title="Siguiente por leer" subtitle={next.title} onPress={() => openBook(next.id)} /> : null}
        </EntityHeader>
      }
      leading={(book) => (book.seriesOrder !== undefined ? `#${book.seriesOrder}` : '–')}
      onOpenBook={(book) => openBook(book.id)}
    />
  );
}
