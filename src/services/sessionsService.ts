import { collection, onSnapshot, orderBy, query, type Firestore } from 'firebase/firestore';

import { db } from '../../firebaseConfig';
import type { NewSessionFields, ReadingSession, ReadingSessionWithId } from '../types/session';
import { createOfflineError, createOfflineGuard } from '../utils/firestoreErrors';
import { api } from './apiClient';

// Las lecturas (`subscribeToSessions`) van directo a Firestore, en tiempo real; las ESCRITURAS pasan por la API, que
// guarda la sesión y mueve el libro en UNA transacción (el progreso del libro nunca queda desfasado de sus sesiones) y
// calcula ella misma las páginas leídas y el día. Ver `api/src/services/sessions.ts`.
// El parámetro `database` de la suscripción permite probarla contra el emulador; en la app siempre se usa `db`.
const sessionsCollection = (uid: string, database: Firestore) => collection(database, 'users', uid, 'sessions');

/** La zona horaria del dispositivo: con ella el servidor decide a qué día pertenece cada sesión (rachas y calendario). */
const deviceTimeZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

const bookPath = (bookId: string) => `/v1/books/${encodeURIComponent(bookId)}`;
const sessionPath = (sessionId: string) => `/v1/sessions/${encodeURIComponent(sessionId)}`;

/** Los datos de una sesión tal como los espera la API: sin lo que ella calcula (páginas leídas y día). */
function sessionBody(fields: NewSessionFields) {
  return {
    date: fields.date.toISOString(),
    timeZone: deviceTimeZone(),
    durationMinutes: fields.durationMinutes,
    startPage: fields.startPage,
    endPage: fields.endPage,
    notes: fields.notes,
  };
}

/**
 * Registra una sesión de lectura y actualiza el libro en la MISMA operación atómica (en el servidor): avanza la página
 * actual, pasa a «Leyendo» si no lo estaba y a «Terminado» al llegar a la última página. Devuelve el id de la sesión.
 * `requestId` fija el id (el cronómetro usa `timer-<inicio>`; el formulario, un id por intento): si ya existe una sesión
 * con ese id, la API devuelve esa en lugar de registrar la lectura otra vez.
 */
export async function createSession(fields: NewSessionFields, requestId?: string): Promise<string> {
  const { id } = await api.post<{ id: string }>('/v1/sessions', { ...sessionBody(fields), bookId: fields.bookId, requestId });
  return id;
}

/**
 * Marca un libro como «Terminado». Si faltaban páginas, el servidor las registra como una sesión (sin minutos, de la
 * página actual a la última) en la MISMA transacción, así que estadísticas, calendario y rachas las cuentan como
 * cualquier lectura. Es la única vía para pasar a «Terminado»: `changeBookStatus` no lo admite.
 */
export async function finishBook(bookId: string): Promise<void> {
  await api.post(`${bookPath(bookId)}/finish`, { timeZone: deviceTimeZone() });
}

/**
 * Ajusta a mano la página actual de un libro. Hacia delante es lectura (se registra como una sesión de páginas de hoy);
 * hacia atrás es una corrección que no genera sesión. Sin cambio, no hace nada.
 */
export async function adjustBookProgress(bookId: string, page: number): Promise<void> {
  await api.post(`${bookPath(bookId)}/progress`, { page, timeZone: deviceTimeZone() });
}

/**
 * Elimina una sesión y deja el libro coherente en la MISMA transacción: si esa sesión era la que fijaba la página actual,
 * el libro vuelve a la mayor página de sus demás sesiones. El servidor lee él mismo las demás sesiones del libro.
 */
export async function deleteSession(sessionId: string): Promise<void> {
  await api.delete(sessionPath(sessionId));
}

/**
 * Edita una sesión (fecha, minutos, páginas y notas; el libro no cambia) y actualiza el libro en la MISMA transacción: subir
 * o bajar la página final mueve el progreso del libro de forma coherente. Lo opcional que se vacía se elimina.
 */
export async function updateSession(sessionId: string, fields: NewSessionFields): Promise<void> {
  // Al editar se conserva el día que eligió la persona (`dateKey`): si cambió de zona horaria desde que la registró,
  // recalcularlo movería la lectura de día.
  await api.put(sessionPath(sessionId), { ...sessionBody(fields), dateKey: fields.dateKey });
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
  const isOffline = createOfflineGuard();
  return onSnapshot(
    sessionsQuery,
    // Con metadatos, para enterarse de cuándo el servidor confirma lo que antes solo salía de la caché.
    { includeMetadataChanges: true },
    (snapshot) => {
      if (isOffline(snapshot)) {
        onError(createOfflineError());
        return;
      }
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
