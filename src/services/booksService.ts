import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
  type UpdateData,
} from 'firebase/firestore';

import { db } from '../../firebaseConfig';
import type { NewBookFields, PurchaseFields, ReadingStatus, ReviewFields, UserBook, UserBookWithId } from '../types/book';
import { getProgressAfterPageCountChange, planStatusChange, type StatusChange } from '../utils/book';

// Firestore permite 500 operaciones por lote; se deja margen.
const BATCH_SIZE = 400;

// El parámetro `database` permite probar el servicio contra el emulador; en la app siempre se usa `db`.
const booksCollection = (uid: string, database: Firestore) => collection(database, 'users', uid, 'books');
const bookDoc = (uid: string, bookId: string, database: Firestore) => doc(database, 'users', uid, 'books', bookId);

/**
 * Crea un libro en la biblioteca del usuario y devuelve su id.
 * `createdAt`/`updatedAt` los fija el servidor; las reglas exigen que coincidan con la hora del servidor.
 */
export async function createBook(uid: string, fields: NewBookFields, database: Firestore = db): Promise<string> {
  const plan = planStatusChange({ status: 'want_to_read', currentPage: 0, pageCount: fields.pageCount }, fields.status);
  const ref = await addDoc(booksCollection(uid, database), {
    ...fields,
    ...(plan.setStartedAt ? { startedAt: serverTimestamp() } : {}),
    ...(plan.setFinishedAt ? { finishedAt: serverTimestamp() } : {}),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
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
  return onSnapshot(
    booksQuery,
    (snapshot) => {
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
 * Guarda los datos editables de un libro (título, autores, géneros, saga, páginas, ISBN y portada).
 * Los campos opcionales que el usuario vacía se eliminan del documento. No cambia el estado de lectura ni
 * el progreso, salvo para mantenerlo coherente con un nuevo total de páginas.
 */
export async function updateBookDetails(
  uid: string,
  book: UserBookWithId,
  fields: NewBookFields,
  database: Firestore = db,
): Promise<void> {
  const progress = getProgressAfterPageCountChange(book, fields.pageCount);
  const changes: UpdateData<UserBook> = {
    title: fields.title,
    authors: fields.authors,
    genres: fields.genres ?? deleteField(),
    seriesName: fields.seriesName ?? deleteField(),
    seriesOrder: fields.seriesOrder ?? deleteField(),
    pageCount: fields.pageCount ?? deleteField(),
    isbn13: fields.isbn13 ?? deleteField(),
    coverUrl: fields.coverUrl ?? deleteField(),
    updatedAt: serverTimestamp(),
  };
  if (progress !== undefined) changes.currentPage = progress;
  await updateDoc(bookDoc(uid, book.id, database), changes);
}

/** Campos de Firestore que hay que escribir para aplicar un `StatusChange` (estado, fechas y página). */
export function statusChangeToUpdate(change: StatusChange): UpdateData<UserBook> {
  const changes: UpdateData<UserBook> = { status: change.status, updatedAt: serverTimestamp() };
  if (change.currentPage !== undefined) changes.currentPage = change.currentPage;
  if (change.setStartedAt) changes.startedAt = serverTimestamp();
  if (change.setFinishedAt) changes.finishedAt = serverTimestamp();
  if (change.clearFinishedAt) changes.finishedAt = deleteField();
  return changes;
}

/**
 * Cambia el estado de lectura y ajusta fechas y progreso (ver `planStatusChange`). No hace nada si no cambia.
 * No admite «Terminado»: para eso está `finishBook` (sessionsService), que además registra las páginas que faltaban.
 */
export async function changeBookStatus(
  uid: string,
  book: UserBookWithId,
  next: Exclude<ReadingStatus, 'finished'>,
  database: Firestore = db,
): Promise<void> {
  const plan = planStatusChange(book, next);
  if (book.status === next) return;

  await updateDoc(bookDoc(uid, book.id, database), statusChangeToUpdate(plan));
}

/**
 * Registra la compra de un libro: lo pasa de la lista de deseos a la biblioteca (`acquisition: 'owned'`, el mismo
 * documento, sin duplicarlo) y guarda la fecha y, si se indica, el precio. También sirve para corregir esos datos en un
 * libro ya comprado (sin precio, lo borra). Comprar no cambia el estado de lectura: no implica empezarlo.
 */
export async function savePurchase(
  uid: string,
  book: Pick<UserBookWithId, 'id'>,
  purchase: PurchaseFields,
  database: Firestore = db,
): Promise<void> {
  await updateDoc(bookDoc(uid, book.id, database), {
    acquisition: 'owned',
    purchasedAt: Timestamp.fromDate(purchase.purchasedAt),
    price: purchase.price ?? deleteField(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Guarda las notas personales del libro (ideas, fragmentos, pensamientos); sin texto, las elimina. Son independientes
 * de la reseña: no tocan la calificación ni las opiniones.
 */
export async function saveBookNotes(
  uid: string,
  book: Pick<UserBookWithId, 'id'>,
  notes: string | undefined,
  database: Firestore = db,
): Promise<void> {
  await updateDoc(bookDoc(uid, book.id, database), { notes: notes ?? deleteField(), updatedAt: serverTimestamp() });
}

/**
 * Guarda la reseña del libro: la calificación, la opinión general y las reseñas por tema. Lo que falta se elimina del
 * documento (la reseña guardada es exactamente la que se envía). Es independiente de las notas.
 */
export async function saveBookReview(
  uid: string,
  book: Pick<UserBookWithId, 'id'>,
  review: ReviewFields,
  database: Firestore = db,
): Promise<void> {
  await updateDoc(bookDoc(uid, book.id, database), {
    rating: review.rating ?? deleteField(),
    review: review.review ?? deleteField(),
    specificReviews: review.specificReviews ?? deleteField(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Elimina un libro junto con todas sus sesiones de lectura, para que no queden sesiones huérfanas que
 * distorsionen las estadísticas. Devuelve cuántas sesiones se eliminaron.
 * El libro se borra al final: si algo falla a medias, se puede reintentar.
 */
export async function deleteBook(uid: string, bookId: string, database: Firestore = db): Promise<number> {
  const sessionsQuery = query(collection(database, 'users', uid, 'sessions'), where('bookId', '==', bookId));
  const sessions = await getDocs(sessionsQuery);

  for (let start = 0; start < sessions.docs.length; start += BATCH_SIZE) {
    const batch = writeBatch(database);
    for (const session of sessions.docs.slice(start, start + BATCH_SIZE)) batch.delete(session.ref);
    await batch.commit();
  }

  await deleteDoc(bookDoc(uid, bookId, database));
  return sessions.size;
}
