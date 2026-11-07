import { collection, onSnapshot, orderBy, query, type Firestore } from 'firebase/firestore';

import { db } from '../../firebaseConfig';
import type { NewBookFields, PurchaseFields, ReadingStatus, ReviewFields, UserBook, UserBookWithId } from '../types/book';
import { createOfflineError, createOfflineGuard } from '../utils/firestoreErrors';
import { api } from './apiClient';

// Las lecturas (`subscribeToBooks`) van directo a Firestore, en tiempo real; todas las ESCRITURAS pasan por la API, que
// aplica las reglas de negocio (estados, progreso, fechas…) y escribe con el Admin SDK. Ver `api/src/services/books.ts`.
// El parámetro `database` de la suscripción permite probarla contra el emulador; en la app siempre se usa `db`.
const booksCollection = (uid: string, database: Firestore) => collection(database, 'users', uid, 'books');

const bookPath = (bookId: string) => `/v1/books/${encodeURIComponent(bookId)}`;

/**
 * Crea un libro en la biblioteca del usuario (o en su lista de deseos) y devuelve su id. `requestId` hace que repetir la
 * misma solicitud —p. ej. tras un corte de red— no cree un segundo libro (ver `makeRequestId`).
 */
export async function createBook(fields: NewBookFields, requestId?: string): Promise<string> {
  const { id } = await api.post<{ id: string }>('/v1/books', { ...fields, requestId });
  return id;
}

/**
 * Escucha en tiempo real la biblioteca del usuario, de más reciente a más antigua.
 * Devuelve la función para cancelar la suscripción. Los filtros y la búsqueda se aplican en el cliente.
 */
export function subscribeToBooks(
  uid: string,
  onBooks: (books: UserBookWithId[]) => void,
  onError: (error: Error) => void,
  database: Firestore = db,
): () => void {
  const booksQuery = query(booksCollection(uid, database), orderBy('createdAt', 'desc'));
  const isOffline = createOfflineGuard();
  return onSnapshot(
    booksQuery,
    // Con metadatos, para enterarse de cuándo el servidor confirma lo que antes solo salía de la caché.
    { includeMetadataChanges: true },
    (snapshot) => {
      if (isOffline(snapshot)) {
        onError(createOfflineError());
        return;
      }
      onBooks(
        snapshot.docs.map((document) => ({
          id: document.id,
          // 'estimate': un libro recién creado aún no tiene la hora del servidor; se usa una estimada en lugar de null.
          ...(document.data({ serverTimestamps: 'estimate' }) as UserBook),
        })),
      );
    },
    onError,
  );
}

/**
 * Guarda los datos editables de un libro (título, autores, géneros, saga, páginas, ISBN y portada). Lo opcional que el
 * usuario vacía se elimina del documento. No cambia el estado de lectura ni el progreso, salvo para mantenerlo
 * coherente con un nuevo total de páginas (lo decide el servidor).
 */
export async function updateBookDetails(bookId: string, fields: NewBookFields): Promise<void> {
  await api.patch(bookPath(bookId), fields);
}

/**
 * Cambia el estado de lectura; el servidor ajusta fechas y progreso. No admite «Terminado»: para eso está `finishBook`
 * (sessionsService), que además registra las páginas que faltaban.
 */
export async function changeBookStatus(bookId: string, next: Exclude<ReadingStatus, 'finished'>): Promise<void> {
  await api.put(`${bookPath(bookId)}/status`, { status: next });
}

/**
 * Registra la compra de un libro: lo pasa de la lista de deseos a la biblioteca (el mismo documento) y guarda la fecha y,
 * si se indica, el precio. También sirve para corregir esos datos en un libro ya comprado. Comprar no cambia el estado.
 */
export async function savePurchase(bookId: string, purchase: PurchaseFields): Promise<void> {
  await api.put(`${bookPath(bookId)}/purchase`, { purchasedAt: purchase.purchasedAt.toISOString(), price: purchase.price });
}

/** Guarda las notas personales del libro; sin texto, las elimina. Son independientes de la reseña. */
export async function saveBookNotes(bookId: string, notes: string | undefined): Promise<void> {
  await api.put(`${bookPath(bookId)}/notes`, { notes: notes ?? '' });
}

/**
 * Guarda la reseña: calificación, opinión general y reseñas por tema. Lo que falta se elimina del documento (la guardada es
 * exactamente la enviada). Es independiente de las notas.
 */
export async function saveBookReview(bookId: string, review: ReviewFields): Promise<void> {
  await api.put(`${bookPath(bookId)}/review`, review);
}

/**
 * Elimina un libro junto con todas sus sesiones de lectura, para que no queden sesiones huérfanas que distorsionen las
 * estadísticas. Devuelve cuántas sesiones se eliminaron. Es idempotente.
 */
export async function deleteBook(bookId: string): Promise<number> {
  const { deletedSessions } = await api.delete<{ deletedSessions: number }>(bookPath(bookId), { timeoutMs: 60_000 });
  return deletedSessions;
}
