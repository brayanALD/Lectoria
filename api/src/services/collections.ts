import { FieldValue } from 'firebase-admin/firestore';

import type { CollectionFilters } from '../../../src/types/collection';
import type { ReadingStatus } from '../../../src/types/book';
import { READING_STATUSES } from '../../../src/utils/book';
import {
  MAX_COLLECTION_BOOKS,
  hasFilterCriteria,
  parseBookSelection,
  parseCollectionName,
  uniqueIds,
} from '../../../src/utils/collections';
import { booksRef, collectionsRef, type Ctx } from '../context';
import { ALREADY_EXISTS, isGrpcError } from '../domain/bookUpdates';
import { notFound, validation } from '../errors';
import { Reader, asRecord } from '../validation';

const MAX_FILTER_TEXT = 200;

/** Los nombres de las colecciones actuales, para que no se repita ninguno. */
async function existingNames(ctx: Ctx, uid: string): Promise<{ id: string; name: string }[]> {
  const snap = await collectionsRef(ctx, uid).get();
  return snap.docs.map((doc) => ({ id: doc.id, name: String((doc.data() as { name?: unknown }).name ?? '') }));
}

function validName(text: string | undefined, existing: { id: string; name: string }[], ownId?: string): string {
  const parsed = parseCollectionName(text ?? '', existing, ownId);
  if (!parsed.ok) throw validation({ name: parsed.error });
  return parsed.name;
}

/**
 * Valida la selección de libros de una colección manual: sin repetidos, solo libros que existen y hasta 500. Los ids de
 * libros ya borrados se descartan (así, al guardar una colección, se van limpiando).
 */
async function validBookIds(ctx: Ctx, uid: string, ids: string[]): Promise<string[]> {
  const unique = uniqueIds(ids);
  if (unique.length > MAX_COLLECTION_BOOKS) {
    throw validation({ bookIds: `Una colección admite hasta ${MAX_COLLECTION_BOOKS} libros.` });
  }
  const snaps = unique.length > 0 ? await ctx.db.getAll(...unique.map((id) => booksRef(ctx, uid).doc(id))) : [];
  const existing = snaps.filter((snap) => snap.exists).map((snap) => ({ id: snap.id }));
  // `parseBookSelection` solo necesita los ids de los libros que existen.
  const parsed = parseBookSelection(unique, existing as unknown as Parameters<typeof parseBookSelection>[1]);
  if (!parsed.ok) throw validation({ bookIds: parsed.error });
  return parsed.bookIds;
}

function readIds(r: Reader): string[] | undefined {
  const value = r.data.bookIds;
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || value.some((id) => typeof id !== 'string' || id.length === 0 || id.length > 128 || id.includes('/'))) {
    return r.fail('bookIds', 'Debe ser una lista de identificadores de libro.');
  }
  return value as string[];
}

/** Los filtros de una estantería: la lista (propios o deseos) y al menos un criterio más. Nunca guarda criterios vacíos. */
function readFilters(r: Reader): CollectionFilters | undefined {
  const value = r.data.filters;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return r.fail('filters', 'Una estantería necesita sus filtros.');
  }
  const f = new Reader(value as Record<string, unknown>);
  const acquisition = f.string('acquisition', { required: true });
  if (acquisition !== undefined && acquisition !== 'owned' && acquisition !== 'wishlist') {
    f.fail('acquisition', 'Debe ser «owned» o «wishlist».');
  }
  const text = (key: string) => {
    const v = f.string(key, { max: MAX_FILTER_TEXT * 2 })?.trim().replace(/\s+/g, ' ');
    if (v !== undefined && v.length > MAX_FILTER_TEXT) f.fail(key, `No puede superar ${MAX_FILTER_TEXT} caracteres.`);
    return v || undefined;
  };
  const query = text('query');
  const genre = text('genre');
  const author = text('author');
  const series = text('series');
  const status = f.string('status');
  if (status !== undefined && !(READING_STATUSES as readonly string[]).includes(status)) {
    f.fail('status', 'Elige un estado de lectura válido.');
  }
  if (Object.keys(f.fields).length > 0) {
    for (const [key, message] of Object.entries(f.fields)) r.fail(`filters.${key}`, message);
    return undefined;
  }
  const filters: CollectionFilters = { acquisition: acquisition as CollectionFilters['acquisition'] };
  if (query) filters.query = query;
  // El estado de lectura solo vale en «Mis libros»: un deseo no tiene estado que filtrar.
  if (status && acquisition === 'owned') filters.status = status as ReadingStatus;
  if (genre) filters.genre = genre;
  if (author) filters.author = author;
  if (series) filters.series = series;
  if (!hasFilterCriteria(filters)) return r.fail('filters', 'Elige al menos un criterio además de la lista.');
  return filters;
}

/**
 * Crea una colección manual (con los libros elegidos) o una estantería filtrada (con los filtros guardados). Con
 * `requestId`, repetir la solicitud devuelve la colección ya creada. El tipo no cambia nunca después.
 */
export async function createCollection(ctx: Ctx, uid: string, raw: unknown): Promise<{ id: string; repeated: boolean }> {
  const r = new Reader(asRecord(raw));
  const requestId = r.requestId();
  const kind = r.string('kind', { required: true });
  if (kind !== undefined && kind !== 'manual' && kind !== 'filter') r.fail('kind', 'Debe ser «manual» o «filter».');
  const name = r.string('name', { required: true });
  const ids = kind === 'manual' ? readIds(r) : undefined;
  const filters = kind === 'filter' ? readFilters(r) : undefined;
  r.done();

  const ref = requestId ? collectionsRef(ctx, uid).doc(requestId) : collectionsRef(ctx, uid).doc();
  // Antes de comprobar el nombre: si es un reintento de una creación que ya se hizo, el nombre ya existe (es el suyo).
  if (requestId && (await ref.get()).exists) return { id: ref.id, repeated: true };

  const cleanName = validName(name, await existingNames(ctx, uid));
  const base = { name: cleanName, kind, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() };
  const data = kind === 'manual' ? { ...base, bookIds: await validBookIds(ctx, uid, ids ?? []) } : { ...base, filters };
  try {
    await ref.create(data);
  } catch (error) {
    if (isGrpcError(error, ALREADY_EXISTS)) return { id: ref.id, repeated: true };
    throw error;
  }
  return { id: ref.id, repeated: false };
}

/**
 * Guarda los cambios de una colección en una sola escritura: el nombre y, en una manual, sus libros (la selección
 * completa). Una estantería solo cambia de nombre.
 */
export async function updateCollection(ctx: Ctx, uid: string, collectionId: string, raw: unknown): Promise<void> {
  const r = new Reader(asRecord(raw));
  const name = r.string('name');
  const ids = readIds(r);
  r.done();

  const ref = collectionsRef(ctx, uid).doc(collectionId);
  const snap = await ref.get();
  if (!snap.exists) throw notFound('Esa colección ya no existe.');
  const kind = (snap.data() as { kind?: string }).kind;
  if (ids !== undefined && kind !== 'manual') {
    throw validation({ bookIds: 'Una estantería filtrada no tiene libros elegidos a mano.' });
  }

  const changes: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
  if (name !== undefined) changes.name = validName(name, await existingNames(ctx, uid), collectionId);
  if (ids !== undefined) changes.bookIds = await validBookIds(ctx, uid, ids);
  await ref.update(changes);
}

/** Elimina la colección o estantería. Sus libros no se tocan. Es idempotente. */
export async function deleteCollection(ctx: Ctx, uid: string, collectionId: string): Promise<void> {
  await collectionsRef(ctx, uid).doc(collectionId).delete();
}
