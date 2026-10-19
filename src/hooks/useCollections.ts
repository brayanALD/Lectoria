import { useMemo } from 'react';

import { useReadingData } from '../context/ReadingDataContext';
import type { CollectionWithId } from '../types/collection';
import { sortCollectionsByName } from '../utils/collections';

interface UseCollectionsResult {
  /** Colecciones y estanterías del usuario actual, por nombre. */
  collections: CollectionWithId[];
  /** true hasta que llega la primera respuesta. Sin colecciones NO es «cargando». */
  loading: boolean;
  /** Mensaje para el usuario si la suscripción falló; null si todo va bien. */
  error: string | null;
  /** Vuelve a suscribirse tras un error. */
  retry: () => void;
}

/** Las colecciones del usuario en tiempo real, leídas de la suscripción única de `ReadingDataProvider`. */
export function useCollections(): UseCollectionsResult {
  const { collections } = useReadingData();
  const sorted = useMemo(() => sortCollectionsByName(collections.items), [collections.items]);
  return useMemo(
    () => ({ collections: sorted, loading: collections.loading, error: collections.error, retry: collections.retry }),
    [sorted, collections.loading, collections.error, collections.retry],
  );
}

/** Una colección por su id; `undefined` si no existe (p. ej. se eliminó). Mismos estados de carga y error que la lista. */
export function useCollection(collectionId: string): Omit<UseCollectionsResult, 'collections'> & { collection: CollectionWithId | undefined } {
  const { collections, loading, error, retry } = useCollections();
  const collection = useMemo(() => collections.find((item) => item.id === collectionId), [collections, collectionId]);
  return useMemo(() => ({ collection, loading, error, retry }), [collection, loading, error, retry]);
}
