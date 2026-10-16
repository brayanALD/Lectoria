import {
  collection,
  deleteField,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';

import { db } from '../../firebaseConfig';
import type { UserBookWithId } from '../types/book';
import type { NewSessionFields, ReadingSession, ReadingSessionWithId } from '../types/session';
import { planStatusChange } from '../utils/book';
import {
  planBookAfterSessionChange,
  planFinishReading,
  planProgressCorrection,
  planSessionBookUpdate,
  toDateKey,
} from '../utils/session';
import { statusChangeToUpdate } from './booksService';

// El parámetro `database` permite probar el servicio contra el emulador; en la app siempre se usa `db`.
const sessionsCollection = (uid: string, database: Firestore) => collection(database, 'users', uid, 'sessions');

/**
 * Registra una sesión de lectura y actualiza el libro en la MISMA operación atómica: o se guardan las dos cosas
 * o ninguna, así el progreso del libro nunca queda desfasado de sus sesiones.
 * Efecto en el libro (ver `planSessionBookUpdate`): avanza la página actual, pasa a «Leyendo» si no lo estaba y
 * a «Terminado» al llegar a la última página. Devuelve el id de la sesión.
 * `sessionId` fija el id (el cronómetro usa uno propio): si ya existe una sesión con ese id, las reglas rechazan el
 * segundo guardado, así que una misma lectura no puede registrarse dos veces.
 */
export async function createSession(
  uid: string,
  book: UserBookWithId,
  fields: NewSessionFields,
  database: Firestore = db,
  sessionId?: string,
): Promise<string> {
  const batch = writeBatch(database);

  const sessionRef = sessionId ? doc(sessionsCollection(uid, database), sessionId) : doc(sessionsCollection(uid, database));
  batch.set(sessionRef, {
    bookId: fields.bookId,
    date: Timestamp.fromDate(fields.date),
    dateKey: fields.dateKey,
    pagesRead: fields.pagesRead,
    durationMinutes: fields.durationMinutes,
    ...(fields.startPage !== undefined ? { startPage: fields.startPage } : {}),
    ...(fields.endPage !== undefined ? { endPage: fields.endPage } : {}),
    ...(fields.notes ? { notes: fields.notes } : {}),
    createdAt: serverTimestamp(),
  });

  const plan = planSessionBookUpdate(book, fields.endPage);
  if (plan.changed) batch.update(doc(database, 'users', uid, 'books', book.id), statusChangeToUpdate(plan));

  await batch.commit();
  return sessionRef.id;
}

/**
 * Marca un libro como «Terminado». Si faltaban páginas para el final, las registra como una sesión de lectura (sin
 * minutos, de la página actual a la última; ver `planFinishReading`) en la MISMA operación atómica que cambia el
 * libro, así que las estadísticas, el calendario y las rachas las cuentan como cualquier otra lectura. Si no se
 * conoce el total de páginas o el libro ya estaba en la última, solo cambia el estado (no hay nada que registrar), y
 * volver a terminar un libro reabierto no duplica la lectura. No hace nada si el libro ya está terminado.
 * Es la única vía para pasar a «Terminado»: `changeBookStatus` no lo admite.
 */
export async function finishBook(
  uid: string,
  book: UserBookWithId,
  now: Date = new Date(),
  database: Firestore = db,
): Promise<void> {
  if (book.status === 'finished') return;

  const reading = planFinishReading(book.id, book, now);
  if (reading) {
    // Llegar a la última página termina el libro (y fija startedAt/finishedAt) en el mismo lote que la sesión.
    await createSession(uid, book, reading, database);
    return;
  }
  await updateDoc(doc(database, 'users', uid, 'books', book.id), statusChangeToUpdate(planStatusChange(book, 'finished')));
}

/**
 * Ajusta a mano la página actual de un libro.
 * - Hacia delante: es lectura, así que se registra como una sesión de páginas (sin minutos) de hoy; cuenta para las
 *   estadísticas y, si supera 1 página, para la racha. Si llega a la última página, el libro pasa a «Terminado».
 * - Hacia atrás: es una corrección, no genera sesión. Un libro terminado vuelve a «Leyendo».
 * - Sin cambio: no hace nada.
 */
export async function adjustBookProgress(
  uid: string,
  book: UserBookWithId,
  page: number,
  now: Date = new Date(),
  database: Firestore = db,
): Promise<void> {
  if (page === book.currentPage) return;

  if (page > book.currentPage) {
    await createSession(
      uid,
      book,
      {
        bookId: book.id,
        date: now,
        dateKey: toDateKey(now),
        startPage: book.currentPage,
        endPage: page,
        pagesRead: page - book.currentPage,
        durationMinutes: 0,
      },
      database,
    );
    return;
  }

  await updateDoc(doc(database, 'users', uid, 'books', book.id), statusChangeToUpdate(planProgressCorrection(book, page)));
}

/**
 * Elimina una sesión y deja el libro coherente en la MISMA operación atómica: si esa sesión era la que fijaba la
 * página actual, el libro vuelve a la mayor página de sus demás sesiones (ver `planBookAfterSessionChange`), sin
 * que haya que corregirlo a mano. `sessions` es la lista completa de sesiones del usuario (la que ya sincroniza
 * `useSessions`); de ella se toman las demás sesiones del libro. Si el libro ya no existe, solo se borra la sesión.
 */
export async function deleteSession(
  uid: string,
  session: ReadingSessionWithId,
  book: UserBookWithId | undefined,
  sessions: readonly ReadingSessionWithId[],
  database: Firestore = db,
): Promise<void> {
  const batch = writeBatch(database);
  batch.delete(doc(database, 'users', uid, 'sessions', session.id));

  if (book) {
    const plan = planBookAfterSessionChange(book, siblingsOf(session, sessions), session, undefined);
    if (plan.changed) batch.update(doc(database, 'users', uid, 'books', book.id), statusChangeToUpdate(plan));
  }
  await batch.commit();
}

/**
 * Edita una sesión (fecha, minutos, páginas y notas; el libro no cambia) y actualiza el libro en la MISMA
 * operación atómica según `planBookAfterSessionChange`: subir o bajar la página final mueve el progreso del libro
 * de forma coherente. Los campos opcionales que se vacían se eliminan de la sesión.
 */
export async function updateSession(
  uid: string,
  session: ReadingSessionWithId,
  fields: NewSessionFields,
  book: UserBookWithId | undefined,
  sessions: readonly ReadingSessionWithId[],
  database: Firestore = db,
): Promise<void> {
  const batch = writeBatch(database);
  batch.update(doc(database, 'users', uid, 'sessions', session.id), {
    date: Timestamp.fromDate(fields.date),
    dateKey: fields.dateKey,
    pagesRead: fields.pagesRead,
    durationMinutes: fields.durationMinutes,
    startPage: fields.startPage ?? deleteField(),
    endPage: fields.endPage ?? deleteField(),
    notes: fields.notes ?? deleteField(),
  });

  if (book) {
    const plan = planBookAfterSessionChange(book, siblingsOf(session, sessions), session, fields);
    if (plan.changed) batch.update(doc(database, 'users', uid, 'books', book.id), statusChangeToUpdate(plan));
  }
  await batch.commit();
}

/** Las demás sesiones del mismo libro (sin la indicada). */
function siblingsOf(session: ReadingSessionWithId, sessions: readonly ReadingSessionWithId[]): ReadingSessionWithId[] {
  return sessions.filter((other) => other.bookId === session.bookId && other.id !== session.id);
}

/**
 * Escucha en tiempo real todas las sesiones del usuario, de la más reciente a la más antigua.
 * El calendario, las rachas y las estadísticas se calculan sobre esta lista. Devuelve la función para cancelar.
 */
export function subscribeToSessions(
  uid: string,
  onSessions: (sessions: ReadingSessionWithId[]) => void,
  onError: (error: Error) => void,
  database: Firestore = db,
): () => void {
  const sessionsQuery = query(sessionsCollection(uid, database), orderBy('date', 'desc'));
  return onSnapshot(
    sessionsQuery,
    (snapshot) => {
      onSessions(
        snapshot.docs.map((document) => ({
          id: document.id,
          // 'estimate': una sesión recién creada aún no tiene la hora del servidor; se usa una estimada en lugar de null.
          ...(document.data({ serverTimestamps: 'estimate' }) as ReadingSession),
        })),
      );
    },
    onError,
  );
}
