import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';

import { db } from '../../firebaseConfig';
import type { UserBookWithId } from '../types/book';
import type { NewSessionFields, ReadingSession, ReadingSessionWithId } from '../types/session';
import { planSessionBookUpdate } from '../utils/session';
import { statusChangeToUpdate } from './booksService';

// El parámetro `database` permite probar el servicio contra el emulador; en la app siempre se usa `db`.
const sessionsCollection = (uid: string, database: Firestore) => collection(database, 'users', uid, 'sessions');

/**
 * Registra una sesión de lectura y actualiza el libro en la MISMA operación atómica: o se guardan las dos cosas
 * o ninguna, así el progreso del libro nunca queda desfasado de sus sesiones.
 * Efecto en el libro (ver `planSessionBookUpdate`): avanza la página actual, pasa a «Leyendo» si no lo estaba y
 * a «Terminado» al llegar a la última página. Devuelve el id de la sesión.
 */
export async function createSession(
  uid: string,
  book: UserBookWithId,
  fields: NewSessionFields,
  database: Firestore = db,
): Promise<string> {
  const batch = writeBatch(database);

  const sessionRef = doc(sessionsCollection(uid, database));
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
 * Elimina una sesión. No modifica el libro: la página actual no retrocede sola (se ajustaría a mano), para no
 * borrar un avance que pudo registrarse por otro camino.
 */
export async function deleteSession(uid: string, sessionId: string, database: Firestore = db): Promise<void> {
  await deleteDoc(doc(database, 'users', uid, 'sessions', sessionId));
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
