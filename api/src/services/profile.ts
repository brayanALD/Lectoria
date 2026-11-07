import { FieldValue } from 'firebase-admin/firestore';

import { parseGoalInput } from '../../../src/utils/dailyGoal';
import { parseMonthlyGoalInput } from '../../../src/utils/monthlyGoal';
import type { GoalType } from '../../../src/types/goal';
import { userRef, type Ctx } from '../context';
import { ALREADY_EXISTS, NOT_FOUND_GRPC, isGrpcError } from '../domain/bookUpdates';
import { notFound, validation } from '../errors';
import type { AuthUser } from '../middleware/auth';
import { Reader, asRecord, isValidTimeZone } from '../validation';

const MAX_DISPLAY_NAME = 60;
const MAX_NICKNAME = 30;

/**
 * Crea `users/{uid}` si no existe (idempotente: se llama en cada inicio de sesión). El nombre sale de lo que indicó la
 * persona al registrarse o, si no, de la cuenta (p. ej. Google) o del correo. La zona horaria alimenta el cálculo del
 * día de cada sesión. Devuelve si se creó ahora.
 */
export async function ensureProfile(ctx: Ctx, user: AuthUser, raw: unknown): Promise<{ created: boolean }> {
  const r = new Reader(asRecord(raw));
  const displayInput = r.string('displayName')?.trim().replace(/\s+/g, ' ');
  if (displayInput && displayInput.length > MAX_DISPLAY_NAME) r.fail('displayName', `No puede superar ${MAX_DISPLAY_NAME} caracteres.`);
  const nickname = r.string('nickname')?.trim().replace(/\s+/g, ' ');
  if (nickname && nickname.length > MAX_NICKNAME) r.fail('nickname', `No puede superar ${MAX_NICKNAME} caracteres.`);
  const zone = r.string('timeZone', { max: 64 });
  r.done();

  const displayName = (displayInput || user.name.trim() || user.email.split('@')[0] || 'Lector').slice(0, MAX_DISPLAY_NAME);
  try {
    await userRef(ctx, user.uid).create({
      createdAt: FieldValue.serverTimestamp(),
      timeZone: zone && isValidTimeZone(zone) ? zone : 'UTC',
      displayName,
      ...(nickname ? { nickname } : {}),
    });
  } catch (error) {
    if (isGrpcError(error, ALREADY_EXISTS)) return { created: false };
    throw error;
  }
  return { created: true };
}

/** Actualiza campos de un perfil que ya existe; si no existe, 404 (la única creación es `ensureProfile`). */
async function updateProfile(ctx: Ctx, uid: string, changes: Record<string, unknown>): Promise<void> {
  try {
    await userRef(ctx, uid).update(changes);
  } catch (error) {
    if (isGrpcError(error, NOT_FOUND_GRPC)) throw notFound('Tu perfil todavía no existe. Vuelve a iniciar sesión.');
    throw error;
  }
}

/**
 * Fija la meta diaria (minutos o páginas, nunca las dos). Cambiar de tipo es una sola escritura: se guarda el campo del
 * tipo nuevo y se elimina el del otro.
 */
export async function setDailyGoal(ctx: Ctx, uid: string, raw: unknown): Promise<void> {
  const r = new Reader(asRecord(raw));
  const type = r.string('type', { required: true });
  if (type !== undefined && type !== 'minutes' && type !== 'pages') r.fail('type', 'Debe ser «minutes» o «pages».');
  const target = r.integer('target', { required: true });
  r.done();

  const parsed = parseGoalInput(String(target), type as GoalType);
  if (!parsed.ok) throw validation({ target: parsed.error });
  await updateProfile(ctx, uid, {
    dailyGoalMinutes: type === 'minutes' ? parsed.target : FieldValue.delete(),
    dailyGoalPages: type === 'pages' ? parsed.target : FieldValue.delete(),
  });
}

/** Quita la meta diaria. */
export async function clearDailyGoal(ctx: Ctx, uid: string): Promise<void> {
  await updateProfile(ctx, uid, { dailyGoalMinutes: FieldValue.delete(), dailyGoalPages: FieldValue.delete() });
}

/** Fija el objetivo mensual de libros. */
export async function setMonthlyBooksGoal(ctx: Ctx, uid: string, raw: unknown): Promise<void> {
  const r = new Reader(asRecord(raw));
  const target = r.integer('target', { required: true });
  r.done();
  const parsed = parseMonthlyGoalInput(String(target));
  if (!parsed.ok) throw validation({ target: parsed.error });
  await updateProfile(ctx, uid, { monthlyBooksGoal: parsed.target });
}

/** Quita el objetivo mensual de libros. */
export async function clearMonthlyBooksGoal(ctx: Ctx, uid: string): Promise<void> {
  await updateProfile(ctx, uid, { monthlyBooksGoal: FieldValue.delete() });
}

/**
 * Elimina todos los datos de la cuenta: libros, lecturas, colecciones, cualquier otra subcolección y, al final, el perfil.
 * Firestore no borra las subcolecciones al borrar el documento padre; `recursiveDelete` recorre todas (también las que se
 * añadan en el futuro, sin tocar esta función). Idempotente: si se interrumpe, repetirlo borra lo que quede. No elimina el
 * usuario de Authentication: eso lo hace la app tras confirmar la identidad de la persona.
 */
export async function deleteAccountData(ctx: Ctx, uid: string): Promise<void> {
  await ctx.db.recursiveDelete(userRef(ctx, uid));
}
