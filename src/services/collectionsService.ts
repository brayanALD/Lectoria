import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type Firestore,
} from 'firebase/firestore';

import { db } from '../../firebaseConfig';
import type { Collection, CollectionFilters, CollectionWithId } from '../types/collection';
import { createOfflineError, createOfflineGuard } from '../utils/firestoreErrors';

// El parámetro `database` permite probar el servicio contra el emulador; en la app siempre se usa `db`.
const collectionsRef = (uid: string, database: Firestore) => collection(database, 'users', uid, 'collections');
const collectionDoc = (uid: string, collectionId: string, database: Firestore) =>
  doc(database, 'users', uid, 'collections', collectionId);

/**
 * Crea una colección manual con los libros elegidos y devuelve su id. El nombre ya viene validado
 * (`parseCollectionName`) y los ids, depurados (`parseBookSelection`).
 */
export async function createManualCollection(
  uid: string,
  name: string,
  bookIds: string[],
  database: Firestore = db,
): Promise<string> {
  const ref = await addDoc(collectionsRef(uid, database), {
    name,
    kind: 'manual',
    bookIds,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/** Crea una estantería filtrada con los filtros guardados (`stateToFilters`) y devuelve su id. */
export async function createFilterCollection(
  uid: string,
  name: string,
  filters: CollectionFilters,
  database: Firestore = db,
): Promise<string> {
  const ref = await addDoc(collectionsRef(uid, database), {
    name,
    kind: 'filter',
    filters,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Guarda los cambios de una colección en una sola escritura: el nombre y, en una manual, sus libros (la selección
 * completa, ya depurada con `parseBookSelection`). Una estantería solo cambia de nombre.
 */
export async function updateCollection(
  uid: string,
  collectionId: string,
  changes: { name?: string; bookIds?: string[] },
  database: Firestore = db,
): Promise<void> {
  await updateDoc(collectionDoc(uid, collectionId, database), { ...changes, updatedAt: serverTimestamp() });
}

/** Elimina la colección o estantería. Sus libros no se tocan. */
export async function deleteCollection(uid: string, collectionId: string, database: Firestore = db): Promise<void> {
  await deleteDoc(collectionDoc(uid, collectionId, database));
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
