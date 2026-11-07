import type { NextFunction, Request, Response } from 'express';

import { ApiError } from '../errors';

export const routeNotFound = (_req: Request, _res: Response, next: NextFunction) =>
  next(new ApiError(404, 'ROUTE_NOT_FOUND', 'La ruta solicitada no existe.'));

// Códigos gRPC transitorios de Firestore: ABORTED (10), UNAVAILABLE (14), DEADLINE_EXCEEDED (4), RESOURCE_EXHAUSTED (8).
const TRANSIENT_GRPC = [10, 14, 4, 8];

type Logger = Pick<Console, 'error'>;

/**
 * Último middleware: convierte cualquier error en { error: { code, message, fields? } }.
 * Los errores inesperados no filtran detalles internos al cliente.
 */
export function handleErrors(logger: Logger = console) {
  return (error: unknown, req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof ApiError) {
      return res.status(error.status).json({
        error: { code: error.code, message: error.message, ...(error.fields ? { fields: error.fields } : {}) },
      });
    }
    const err = error as { type?: string; code?: unknown } | undefined;
    if (err?.type === 'entity.parse.failed' || error instanceof SyntaxError) {
      return res
        .status(400)
        .json({ error: { code: 'VALIDATION', message: 'El cuerpo de la solicitud no es un JSON válido.' } });
    }
    if (err?.type === 'entity.too.large') {
      return res.status(413).json({ error: { code: 'TOO_LARGE', message: 'La solicitud es demasiado grande.' } });
    }
    if (
      (typeof err?.code === 'number' && TRANSIENT_GRPC.includes(err.code)) ||
      err?.code === 'aborted' ||
      err?.code === 'unavailable'
    ) {
      logger.error(`[transitorio] ${req.method} ${req.originalUrl}:`, error);
      return res.status(503).json({
        error: { code: 'BUSY', message: 'El servidor está ocupado. Inténtalo de nuevo en unos segundos.' },
      });
    }
    logger.error(`[error] ${req.method} ${req.originalUrl}:`, error);
    return res
      .status(500)
      .json({ error: { code: 'INTERNAL', message: 'No se pudo completar la operación. Inténtalo de nuevo.' } });
  };
}
