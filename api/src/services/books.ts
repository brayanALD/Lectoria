import { FieldValue, Timestamp, type DocumentReference, type Transaction } from 'firebase-admin/firestore';

import type { UserBook } from '../../../src/types/book';
import {
  READING_STATUSES,
  getProgressAfterPageCountChange,
  planStatusChange,
} from '../../../src/utils/book';
import { MAX_PRICE } from '../../../src/utils/purchase';
import { parseNotes, parseReviewForm } from '../../../src/utils/review';
import { booksRef, sessionsRef, type Ctx } from '../context';
import { ALREADY_EXISTS, isGrpcError, statusChangeToUpdate } from '../domain/bookUpdates';
import { conflict, notFound, validation } from '../errors';
import { Reader, asRecord, planNewBook, validateBookInput } from '../validation';

// Firestore permite 500 operaciones por lote; se deja margen.
const BATCH_SIZE = 400;
/** Margen para relojes del teléfono ligeramente adelantados al validar que una fecha no es futura. */
export const CLOCK_TOLERANCE_MS = 5 * 60_000;

/** Lee el libro dentro de una transacción; 404 si no existe. */
export async function readBook(tx: Transaction, ref: DocumentReference): Promise<UserBook & { id: string }> {
  const snap = await tx.get(ref);
  if (!snap.exists) throw notFound('Ese libro ya no existe.');
  return { id: ref.id, ...(snap.data() as UserBook) };
}

/** Las sesiones y el progreso solo existen en los libros propios: un deseo todavía no se lee. */
export function assertOwned(book: Pick<UserBook, 'acquisition'>): void {
  if (book.acquisition === 'wishlist') {
    throw conflict('BOOK_NOT_OWNED', 'Este libro está en tu lista de deseos. Márcalo como comprado para registrar lecturas.');
  }
}

/**
 * Crea un libro en la biblioteca (o en la lista de deseos). Con `requestId`, repetir la misma solicitud (p. ej. tras un
 * corte de red) devuelve el libro ya creado en lugar de duplicarlo.
 */
export async function createBook(ctx: Ctx, uid: string, raw: unknown): Promise<{ id: string; repeated: boolean }> {
  const { requestId, data } = validateBookInput(raw);
  const plan = planNewBook(data);
  const ref = requestId ? booksRef(ctx, uid).doc(requestId) : booksRef(ctx, uid).doc();
  try {
    await ref.create({
      ...data,
      ...(plan.setStartedAt ? { startedAt: FieldValue.serverTimestamp() } : {}),
      ...(plan.setFinishedAt ? { finishedAt: FieldValue.serverTimestamp() } : {}),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    if (isGrpcError(error, ALREADY_EXISTS)) return { id: ref.id, repeated: true };
    throw error;
  }
  return { id: ref.id, repeated: false };
}

/**
 * Guarda los datos editables de un libro (título, autores, géneros, saga, páginas, ISBN y portada). Lo opcional que se
 * vacía se elimina. No cambia el estado de lectura ni la adquisición; el progreso solo se toca para mantenerlo
 * coherente con un nuevo total de páginas (`getProgressAfterPageCountChange`).
 */
export async function updateBookDetails(ctx: Ctx, uid: string, bookId: string, raw: unknown): Promise<void> {
  const { data } = validateBookInput({ ...asRecord(raw), acquisition: undefined, status: undefined });
  const ref = booksRef(ctx, uid).doc(bookId);
  await ctx.db.runTransaction(async (tx) => {
    const book = await readBook(tx, ref);
    const progress = getProgressAfterPageCountChange(book, data.pageCount);
    const changes: Record<string, unknown> = {
      title: data.title,
      authors: data.authors,
      genres: data.genres ?? FieldValue.delete(),
      seriesName: data.seriesName ?? FieldValue.delete(),
      seriesOrder: data.seriesOrder ?? FieldValue.delete(),
      pageCount: data.pageCount ?? FieldValue.delete(),
      isbn13: data.isbn13 ?? FieldValue.delete(),
      coverUrl: data.coverUrl ?? FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (progress !== undefined) changes.currentPage = progress;
    tx.update(ref, changes);
  });
}

/**
 * Cambia el estado de lectura y ajusta fechas y progreso (`planStatusChange`). No hace nada si no cambia.
 * No admite «Terminado»: para eso está `finishBook` (sesiones), que además registra las páginas que faltaban.
 */
export async function changeBookStatus(ctx: Ctx, uid: string, bookId: string, raw: unknown): Promise<void> {
  const r = new Reader(asRecord(raw));
  const status = r.string('status', { required: true });
  if (status !== undefined && !(READING_STATUSES as readonly string[]).includes(status)) {
    r.fail('status', 'Elige un estado de lectura válido.');
  } else if (status === 'finished') {
    r.fail('status', 'Para terminar un libro usa su acción «finish»: registra las páginas que faltaban.');
  }
  r.done();

  const ref = booksRef(ctx, uid).doc(bookId);
  await ctx.db.runTransaction(async (tx) => {
    const book = await readBook(tx, ref);
    if (book.status === status) return;
    tx.update(ref, statusChangeToUpdate(planStatusChange(book, status as UserBook['status'])));
  });
}

/**
 * Registra la compra de un libro: lo pasa de la lista de deseos a la biblioteca (el mismo documento) y guarda la fecha
 * y, si se indica, el precio (sin moneda). También corrige esos datos en un libro ya comprado (sin precio, lo borra).
 * Comprar no cambia el estado de lectura.
 */
export async function savePurchase(ctx: Ctx, uid: string, bookId: string, raw: unknown): Promise<void> {
  const r = new Reader(asRecord(raw));
  const purchasedAt = r.date('purchasedAt', { required: true });
  const price = r.number('price', { min: 0, max: MAX_PRICE });
  if (purchasedAt && purchasedAt.getTime() > ctx.now().getTime() + CLOCK_TOLERANCE_MS) {
    r.fail('purchasedAt', 'La fecha de compra no puede ser futura.');
  }
  r.done();

  const ref = booksRef(ctx, uid).doc(bookId);
  await ctx.db.runTransaction(async (tx) => {
    await readBook(tx, ref);
    tx.update(ref, {
      acquisition: 'owned',
      purchasedAt: Timestamp.fromDate(purchasedAt as Date),
      price: price === undefined ? FieldValue.delete() : Math.round(price * 100) / 100,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
}

/** Guarda las notas personales del libro; sin texto, las elimina. Son independientes de la reseña. */
export async function saveBookNotes(ctx: Ctx, uid: string, bookId: string, raw: unknown): Promise<void> {
  const r = new Reader(asRecord(raw));
  const text = r.string('notes') ?? '';
  r.done();
  const parsed = parseNotes(text);
  if (!parsed.ok) throw validation({ notes: parsed.error });

  const ref = booksRef(ctx, uid).doc(bookId);
  await ctx.db.runTransaction(async (tx) => {
    await readBook(tx, ref);
    tx.update(ref, { notes: parsed.notes ?? FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() });
  });
}

/**
 * Guarda la reseña: calificación, opinión general y reseñas por tema. Lo que falta se elimina del documento (lo
 * guardado es exactamente lo enviado). Las reglas son las del formulario (`parseReviewForm`).
 */
export async function saveBookReview(ctx: Ctx, uid: string, bookId: string, raw: unknown): Promise<void> {
  const body = asRecord(raw);
  const r = new Reader(body);
  const rating = r.number('rating') ?? 0;
  const review = r.string('review') ?? '';
  const list = body.specificReviews;
  const specific: { id: string; topic: string; text: string }[] = [];
  if (list !== undefined && list !== null) {
    if (!Array.isArray(list)) r.fail('specificReviews', 'Debe ser una lista.');
    else {
      list.forEach((item, index) => {
        const entry = typeof item === 'object' && item !== null ? (item as Record<string, unknown>) : {};
        if (typeof entry.topic !== 'string' || typeof entry.text !== 'string') {
          r.fail(`specificReviews.${index}`, 'Cada reseña lleva un tema y un texto.');
        } else {
          specific.push({ id: String(index), topic: entry.topic, text: entry.text });
        }
      });
    }
  }
  r.done();

  const result = parseReviewForm({ rating, review, specific });
  if (!result.ok) {
    const fields: Record<string, string> = {};
    if (result.errors.rating) fields.rating = result.errors.rating;
    if (result.errors.review) fields.review = result.errors.review;
    if (result.errors.specificList) fields.specificReviews = result.errors.specificList;
    for (const [id, errors] of Object.entries(result.errors.specific ?? {})) {
      if (errors.topic) fields[`specificReviews.${id}.topic`] = errors.topic;
      if (errors.text) fields[`specificReviews.${id}.text`] = errors.text;
    }
    throw validation(fields);
  }

  const ref = booksRef(ctx, uid).doc(bookId);
  await ctx.db.runTransaction(async (tx) => {
    await readBook(tx, ref);
    tx.update(ref, {
      rating: result.data.rating ?? FieldValue.delete(),
      review: result.data.review ?? FieldValue.delete(),
      specificReviews: result.data.specificReviews ?? FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
}

/**
 * Elimina un libro junto con todas sus sesiones de lectura, para que no queden sesiones huérfanas que distorsionen las
 * estadísticas. Devuelve cuántas sesiones se eliminaron. El libro se borra al final: si algo falla a medias se puede
 * reintentar. Es idempotente (borrar un libro que ya no existe no es un error).
 */
export async function deleteBook(ctx: Ctx, uid: string, bookId: string): Promise<number> {
  const sessions = await sessionsRef(ctx, uid).where('bookId', '==', bookId).get();
  for (let start = 0; start < sessions.docs.length; start += BATCH_SIZE) {
    const batch = ctx.db.batch();
    for (const session of sessions.docs.slice(start, start + BATCH_SIZE)) batch.delete(session.ref);
    await batch.commit();
  }
  await booksRef(ctx, uid).doc(bookId).delete();
  return sessions.size;
}
