import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo } from 'react';

import { EmptyState } from '../../../components/EmptyState';
import { RowListSkeleton } from '../../../components/ListSkeletons';
import { NavRowList } from '../../../components/NavRowList';
import { useBooks } from '../../../hooks/useBooks';
import type { AppStackParamList } from '../../../navigation/types';
import { describeMissingNumbers, describeSeries, summarizeSeries } from '../../../utils/series';

type Props = NativeStackScreenProps<AppStackParamList, 'Series'>;

/** Las sagas de la biblioteca (derivadas de los libros); tocar una abre su detalle. */
export function SeriesListScreen({ navigation }: Props) {
  const { books, loading, error, retry } = useBooks();
  const series = useMemo(() => summarizeSeries(books), [books]);

  if (loading) return <RowListSkeleton label="Cargando sagas" />;

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

  if (series.length === 0) return <EmptyState icon="layers-outline" title="Aún no hay sagas" />;

  return (
    <NavRowList
      items={series.map((saga) => ({
        id: saga.name,
        title: saga.name,
        subtitle: [describeSeries(saga), describeMissingNumbers(saga.missing)].filter(Boolean).join(' · '),
      }))}
      onOpen={(name) => navigation.navigate('SeriesDetail', { name })}
    />
  );
}
