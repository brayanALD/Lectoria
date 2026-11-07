import { collection, onSnapshot, orderBy, query, type Firestore } from 'firebase/firestore';

import { db } from '../../firebaseConfig';
import type { Collection, CollectionFilters, CollectionWithId } from '../types/collection';
import { createOfflineError, createOfflineGuard } from '../utils/firestoreErrors';
import { api } from './apiClient';

// Las lecturas (`subscribeToCollections`) van directo a Firestore; las ESCRITURAS pasan por la API. Ver
// `api/src/services/collections.ts`. El parámetro `database` de la suscripción permite probarla contra el emulador.
const collectionsRef = (uid: string, database: Firestore) => collection(database, 'users', uid, 'collections');

const collectionPath = (collectionId: string) => `/v1/collections/${encodeURIComponent(collectionId)}`;

/**
 * Crea una colección manual con los libros elegidos y devuelve su id. El servidor vuelve a validar el nombre (con
 * contenido, hasta 60 caracteres, sin repetir otro) y descarta los libros que no existan. `requestId` evita duplicarla al
 * reintentar.
 */
export async function createManualCollection(name: string, bookIds: string[], requestId?: string): Promise<string> {
  const { id } = await api.post<{ id: string }>('/v1/collections', { kind: 'manual', name, bookIds, requestId });
  return id;
}

/** Crea una estantería filtrada con los filtros guardados (`stateToFilters`) y devuelve su id. */
export async function createFilterCollection(name: string, filters: CollectionFilters, requestId?: string): Promise<string> {
  const { id } = await api.post<{ id: string }>('/v1/collections', { kind: 'filter', name, filters, requestId });
  return id;
}

/**
 * Guarda los cambios de una colección en una sola escritura: el nombre y, en una manual, sus libros (la selección
 * completa). Una estantería solo cambia de nombre.
 */
export async function updateCollection(collectionId: string, changes: { name?: string; bookIds?: string[] }): Promise<void> {
  await api.patch(collectionPath(collectionId), changes);
}

/** Elimina la colección o estantería. Sus libros no se tocan. */
export async function deleteCollection(collectionId: string): Promise<void> {
  await api.delete(collectionPath(collectionId));
}

/**
 * Escucha en tiempo real las colecciones del usuario, de la más antigua a la más reciente (la pantalla las ordena por
 * nombre). Como las demás listas del usuario, avisa de que no hay conexión en lugar de mostrar una lista vacía que
 * viene de la caché sin haber hablado con el servidor.
 */
export function subscribeToCollections(
  uid: string,
  onCollections: (collections: CollectionWithId[]) => void,
  onError: (error: Error) => void,
  database: Firestore = db,
): () => void {
  const collectionsQuery = query(collectionsRef(uid, database), orderBy('createdAt', 'asc'));
  const isOffline = createOfflineGuard();
  return onSnapshot(
    collectionsQuery,
    { includeMetadataChanges: true },
    (snapshot) => {
      if (isOffline(snapshot)) {
        onError(createOfflineError());
        return;
      }
      onCollections(
        snapshot.docs.map((document) => ({
          id: document.id,
          // 'estimate': una colección recién creada aún no tiene la hora del servidor.
          ...(document.data({ serverTimestamps: 'estimate' }) as Collection),
        })),
      );
    },
    onError,
  );
}
