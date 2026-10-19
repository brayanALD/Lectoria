import type { Timestamp } from 'firebase/firestore';

import type { Acquisition, ReadingStatus } from './book';

/** `manual`: libros elegidos a mano. `filter`: estantería filtrada, sus libros se calculan con los filtros guardados. */
export type CollectionKind = 'manual' | 'filter';

/**
 * Los filtros de una estantería: la lista (propios o deseos) y los criterios de Biblioteca que estaban activos. Un criterio
 * que no se usó no existe (nunca guarda vacíos). Los límites están en `firestore.rules`.
 */
export interface CollectionFilters {
  acquisition: Acquisition;
  query?: string;
  status?: ReadingStatus;
  genre?: string;
  author?: string;
  series?: string;
}

/** Colección personalizada o estantería filtrada: users/{uid}/collections/{id}. */
export interface Collection {
  name: string;
  kind: CollectionKind;
  /** Solo en las manuales. Pueden apuntar a libros que ya no existen: se ignoran al mostrar la colección. */
  bookIds?: string[];
  /** Solo en las estanterías filtradas. */
  filters?: CollectionFilters;
  /** Los fija el servidor (serverTimestamp()); las reglas exigen que coincidan con request.time. */
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** Una colección leída de Firestore, con el id de su documento. */
export type CollectionWithId = Collection & { id: string };
