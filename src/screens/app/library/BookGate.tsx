import type { ReactNode } from 'react';

import { BookFormSkeleton } from '../../../components/BookSkeletons';
import { EmptyState } from '../../../components/EmptyState';
import { useBook } from '../../../hooks/useBook';
import type { UserBookWithId } from '../../../types/book';

interface BookGateProps {
  bookId: string;
  /** Qué hacer si el libro ya no existe («Volver»). */
  onBack: () => void;
  /** Se pinta cuando el libro ya está cargado. */
  children: (book: UserBookWithId) => ReactNode;
}

/**
 * Los estados de una pantalla que trabaja sobre un libro: cargando (silueta del formulario), error al cargar y «este
 * libro ya no existe». Solo cuando hay libro se pinta el contenido, así que el formulario de dentro puede arrancar con
 * sus datos (`useState` inicial) sin esperar nada.
 */
export function BookGate({ bookId, onBack, children }: BookGateProps) {
  const { book, loading, error, retry } = useBook(bookId);

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
    return <EmptyState icon="book-outline" title="Este libro ya no existe" action={{ label: 'Volver', onPress: onBack }} />;
  }

  return <>{children(book)}</>;
}
