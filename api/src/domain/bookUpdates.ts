import { FieldValue } from 'firebase-admin/firestore';

import type { StatusChange } from '../../../src/utils/book';

/**
 * Los campos de Firestore que hay que escribir para aplicar un `StatusChange` (estado, fechas y página): es la versión
 * del servidor de lo que antes hacía la app con el SDK de cliente. La decisión de QUÉ cambia sigue siendo de
 * `planStatusChange` (código compartido); aquí solo se traduce a escritura.
 */
export function statusChangeToUpdate(change: StatusChange): Record<string, unknown> {
  const changes: Record<string, unknown> = { status: change.status, updatedAt: FieldValue.serverTimestamp() };
  if (change.currentPage !== undefined) changes.currentPage = change.currentPage;
  if (change.setStartedAt) changes.startedAt = FieldValue.serverTimestamp();
  if (change.setFinishedAt) changes.finishedAt = FieldValue.serverTimestamp();
  if (change.clearFinishedAt) changes.finishedAt = FieldValue.delete();
  return changes;
}

/** Firestore: el documento ya existe (`create` repetido). */
export const ALREADY_EXISTS = 6;
/** Firestore: el documento no existe (`update` de uno inexistente). */
export const NOT_FOUND_GRPC = 5;

export function isGrpcError(error: unknown, code: number): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === code;
}
