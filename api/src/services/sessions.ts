import { FieldValue, Timestamp, type DocumentReference, type Transaction } from 'firebase-admin/firestore';

import type { UserBook } from '../../../src/types/book';
import type { NewSessionFields, ReadingSession } from '../../../src/types/session';
import { planStatusChange } from '../../../src/utils/book';
import {
  MAX_SESSION_PAGE,
  parseProgressInput,
  parseSessionForm,
  planBookAfterSessionChange,
  planFinishReading,
  planProgressCorrection,
  planSessionBookUpdate,
  toDateKey,
} from '../../../src/utils/session';
import { booksRef, sessionsRef, type Ctx } from '../context';
import { statusChangeToUpdate } from '../domain/bookUpdates';
import { notFound, validation } from '../errors';
import { Reader, asRecord } from '../validation';
import { CLOCK_TOLERANCE_MS, assertOwned, readBook } from './books';

type BookWithId = UserBook & { id: string };

interface SessionInput {
  requestId?: string;
  bookId?: string;
  date: Date;
  timeZone: string;
  /** Solo al editar sin cambiar el día: conserva el día con que se guardó (la zona pudo cambiar desde entonces). */
  dateKey?: string;
  minutes: string;
  startPage: string;
  endPage: string;
  notes: string;
}

/** Lee el cuerpo de una sesión (crear o editar). Los números llegan como números y se pasan al validador compartido. */
function readSessionBody(raw: unknown, options: { withBook: boolean }): SessionInput {
  const r = new Reader(asRecord(raw));
  const requestId = r.requestId();
  const bookId = options.withBook ? r.string('bookId', { required: true, max: 128 }) : undefined;
  const date = r.date('date', { required: true });
  const timeZone = r.timeZone();
  const dateKey = r.string('dateKey', { max: 10 });
  if (dateKey !== undefined && !isPlausibleDateKey(dateKey, date)) {
    r.fail('dateKey', 'Debe ser un día «YYYY-MM-DD» que corresponda a la fecha.');
  }
  const minutes = r.integer('durationMinutes', { min: 0 });
  const startPage = r.integer('startPage', { min: 0 });
  const endPage = r.integer('endPage', { min: 0 });
  const notes = r.string('notes');
  r.done();
  return {
    requestId,
    bookId,
    date: date as Date,
    timeZone: timeZone as string,
    dateKey,
    minutes: minutes === undefined ? '' : String(minutes),
    startPage: startPage === undefined ? '' : String(startPage),
    endPage: endPage === undefined ? '' : String(endPage),
    notes: notes ?? '',
  };
}

/** Un día «YYYY-MM-DD» que cabe con la fecha (cualquier zona horaria del mundo queda a menos de 36 h de su hora UTC). */
function isPlausibleDateKey(dateKey: string, date: Date | undefined): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return false;
  const noon = Date.parse(`${dateKey}T12:00:00Z`);
  if (Number.isNaN(noon)) return false;
  return date === undefined || Math.abs(noon - date.getTime()) <= 36 * 3600_000;
}

/**
 * Valida la sesión con las mismas reglas que el formulario «Registrar lectura» (`parseSessionForm`) y calcula en el
 * servidor lo derivado: las páginas leídas y el día (`dateKey`) en la zona horaria del dispositivo. Una lectura de un día
 * anterior a hoy exige la página inicial (la página actual del libro no dice dónde se empezó entonces).
 */
function parseSession(
  ctx: Ctx,
  input: SessionInput,
  bookId: string,
  book: Pick<UserBook, 'currentPage' | 'pageCount'>,
  options: { forceStartPage?: boolean } = {},
): NewSessionFields {
  const now = ctx.now();
  const dayKey = input.dateKey ?? toDateKey(input.date, input.timeZone);
  const requireStartPage = options.forceStartPage || dayKey < toDateKey(now, input.timeZone);
  const result = parseSessionForm(
    { date: input.date, minutes: input.minutes, startPage: input.startPage, endPage: input.endPage, notes: input.notes },
    bookId,
    book,
    new Date(now.getTime() + CLOCK_TOLERANCE_MS),
    input.timeZone,
    requireStartPage,
  );
  if (!result.ok) {
    // El formulario llama `minutes` a lo que la API llama `durationMinutes`.
    const { minutes, ...rest } = result.errors;
    throw validation({ ...(rest as Record<string, string>), ...(minutes ? { durationMinutes: minutes } : {}) });
  }
  return input.dateKey ? { ...result.data, dateKey: input.dateKey } : result.data;
}

function sessionDocument(fields: NewSessionFields) {
  return {
    bookId: fields.bookId,
    date: Timestamp.fromDate(fields.date),
    dateKey: fields.dateKey,
    pagesRead: fields.pagesRead,
    durationMinutes: fields.durationMinutes,
    ...(fields.startPage !== undefined ? { startPage: fields.startPage } : {}),
    ...(fields.endPage !== undefined ? { endPage: fields.endPage } : {}),
    ...(fields.notes ? { notes: fields.notes } : {}),
    createdAt: FieldValue.serverTimestamp(),
  };
}

/**
 * Escribe una sesión nueva y actualiza el libro en la MISMA transacción: o se guardan las dos cosas o ninguna, así el
 * progreso del libro nunca queda desfasado de sus sesiones (efecto en el libro: `planSessionBookUpdate`).
 * Debe llamarse con las lecturas de la transacción ya hechas.
 */
function writeNewSession(
  tx: Transaction,
  ctx: Ctx,
  uid: string,
  book: BookWithId,
  fields: NewSessionFields,
  sessionRef: DocumentReference,
): void {
  tx.create(sessionRef, sessionDocument(fields));
  const plan = planSessionBookUpdate(book, fields.endPage);
  if (plan.changed) tx.update(booksRef(ctx, uid).doc(book.id), statusChangeToUpdate(plan));
}

/**
 * Registra una sesión de lectura (y mueve el libro). Con `requestId` (el cronómetro usa `timer-<inicio>`) una segunda
 * solicitud igual no registra la lectura otra vez: devuelve la sesión ya creada.
 */
export async function createSession(ctx: Ctx, uid: string, raw: unknown): Promise<{ id: string; repeated: boolean }> {
  const input = readSessionBody(raw, { withBook: true });
  const bookId = input.bookId as string;
  const sessionRef = input.requestId ? sessionsRef(ctx, uid).doc(input.requestId) : sessionsRef(ctx, uid).doc();

  return ctx.db.runTransaction(async (tx) => {
    const book = await readBook(tx, booksRef(ctx, uid).doc(bookId));
    if (input.requestId && (await tx.get(sessionRef)).exists) return { id: sessionRef.id, repeated: true };
    assertOwned(book);
    const fields = parseSession(ctx, input, bookId, book);
    writeNewSession(tx, ctx, uid, book, fields, sessionRef);
    return { id: sessionRef.id, repeated: false };
  });
}

/** Las demás sesiones del mismo libro (sin la indicada), leídas dentro de la transacción. */
async function readSiblings(tx: Transaction, ctx: Ctx, uid: string, bookId: string, sessionId: string) {
  const snap = await tx.get(sessionsRef(ctx, uid).where('bookId', '==', bookId));
  return snap.docs.filter((doc) => doc.id !== sessionId).map((doc) => doc.data() as ReadingSession);
}

/**
 * Edita una sesión (fecha, minutos, páginas y notas; el libro no cambia) y actualiza el libro en la MISMA transacción
 * según `planBookAfterSessionChange`. Los campos opcionales que se vacían se eliminan de la sesión. El servidor lee las
 * demás sesiones del libro él mismo: no se fía de una lista enviada por el cliente.
 */
export async function updateSession(ctx: Ctx, uid: string, sessionId: string, raw: unknown): Promise<void> {
  const input = readSessionBody(raw, { withBook: false });
  const ref = sessionsRef(ctx, uid).doc(sessionId);

  await ctx.db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw notFound('Esa lectura ya no existe.');
    const session = snap.data() as ReadingSession;
    const bookRef = booksRef(ctx, uid).doc(session.bookId);
    const bookSnap = await tx.get(bookRef);
    const book = bookSnap.exists ? ({ id: bookSnap.id, ...(bookSnap.data() as UserBook) } as BookWithId) : undefined;
    const siblings = book ? await readSiblings(tx, ctx, uid, session.bookId, sessionId) : [];

    const fields = parseSession(ctx, input, session.bookId, book ?? { currentPage: 0 }, {
      forceStartPage: session.startPage !== undefined,
    });
    tx.update(ref, {
      date: Timestamp.fromDate(fields.date),
      dateKey: fields.dateKey,
      pagesRead: fields.pagesRead,
      durationMinutes: fields.durationMinutes,
      startPage: fields.startPage ?? FieldValue.delete(),
      endPage: fields.endPage ?? FieldValue.delete(),
      notes: fields.notes ?? FieldValue.delete(),
    });
    if (book) {
      const plan = planBookAfterSessionChange(book, siblings, session, fields);
      if (plan.changed) tx.update(bookRef, statusChangeToUpdate(plan));
    }
  });
}

/**
 * Elimina una sesión y deja el libro coherente en la MISMA transacción: si esa sesión era la que fijaba la página
 * actual, el libro vuelve a la mayor página de sus demás sesiones. Es idempotente (borrarla dos veces no es un error).
 */
export async function deleteSession(ctx: Ctx, uid: string, sessionId: string): Promise<void> {
  const ref = sessionsRef(ctx, uid).doc(sessionId);
  await ctx.db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const session = snap.data() as ReadingSession;
    const bookRef = booksRef(ctx, uid).doc(session.bookId);
    const bookSnap = await tx.get(bookRef);
    const book = bookSnap.exists ? ({ id: bookSnap.id, ...(bookSnap.data() as UserBook) } as BookWithId) : undefined;
    const siblings = book ? await readSiblings(tx, ctx, uid, session.bookId, sessionId) : [];

    tx.delete(ref);
    if (book) {
      const plan = planBookAfterSessionChange(book, siblings, session, undefined);
      if (plan.changed) tx.update(bookRef, statusChangeToUpdate(plan));
    }
  });
}

/**
 * Marca un libro como «Terminado». Si faltaban páginas, las registra como una sesión (sin minutos, de la página actual a
 * la última; `planFinishReading`) en la MISMA transacción que cambia el libro, así que estadísticas, calendario y rachas
 * las cuentan como cualquier lectura. Sin total de páginas, o ya en la última, solo cambia el estado. No hace nada si el
 * libro ya está terminado. Es la única vía para pasar a «Terminado».
 */
export async function finishBook(ctx: Ctx, uid: string, bookId: string, raw: unknown): Promise<void> {
  const r = new Reader(asRecord(raw));
  const timeZone = r.timeZone();
  r.done();

  const ref = booksRef(ctx, uid).doc(bookId);
  await ctx.db.runTransaction(async (tx) => {
    const book = await readBook(tx, ref);
    if (book.status === 'finished') return;
    assertOwned(book);
    const reading = planFinishReading(book.id, book, ctx.now(), timeZone);
    if (reading) {
      // Llegar a la última página termina el libro (y fija startedAt/finishedAt) en la misma transacción.
      writeNewSession(tx, ctx, uid, book, reading, sessionsRef(ctx, uid).doc());
      return;
    }
    tx.update(ref, statusChangeToUpdate(planStatusChange(book, 'finished')));
  });
}

/**
 * Ajusta a mano la página actual de un libro.
 * - Hacia delante: es lectura, se registra como una sesión de páginas (sin minutos) de hoy; si llega a la última página
 *   el libro pasa a «Terminado».
 * - Hacia atrás: es una corrección, no genera sesión. Un libro terminado vuelve a «Leyendo».
 * - Sin cambio: no hace nada.
 */
export async function adjustBookProgress(ctx: Ctx, uid: string, bookId: string, raw: unknown): Promise<void> {
  const r = new Reader(asRecord(raw));
  const page = r.integer('page', { required: true, min: 0 });
  const timeZone = r.timeZone();
  r.done();

  const ref = booksRef(ctx, uid).doc(bookId);
  await ctx.db.runTransaction(async (tx) => {
    const book = await readBook(tx, ref);
    assertOwned(book);
    const parsed = parseProgressInput(String(page), book);
    if (!parsed.ok) throw validation({ page: parsed.error });
    if (parsed.page > MAX_SESSION_PAGE) throw validation({ page: 'Introduce un número de página válido.' });
    if (parsed.page === book.currentPage) return;

    if (parsed.page > book.currentPage) {
      const now = ctx.now();
      writeNewSession(
        tx,
        ctx,
        uid,
        book,
        {
          bookId: book.id,
          date: now,
          dateKey: toDateKey(now, timeZone),
          startPage: book.currentPage,
          endPage: parsed.page,
          pagesRead: parsed.page - book.currentPage,
          durationMinutes: 0,
        },
        sessionsRef(ctx, uid).doc(),
      );
      return;
    }
    tx.update(ref, statusChangeToUpdate(planProgressCorrection(book, parsed.page)));
  });
}

