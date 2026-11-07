import type { NextFunction, Request, Response } from 'express';

import { ApiError } from '../errors';

/**
 * Limita las solicitudes por usuario en una ventana fija de un minuto (en memoria: vale con una sola instancia, que es
 * como se despliega). Protege la cuota de Firestore y el catálogo externo de un cliente defectuoso o abusivo.
 * Va después de `authenticate`, así que se cuenta por `uid` y no por IP (detrás del proxy de Render todas serían la misma).
 */
export function rateLimit(limitPerMinute: number, now: () => number = Date.now) {
  const windows = new Map<string, { start: number; count: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    const time = now();
    const key = req.user.uid;
    let window = windows.get(key);
    if (!window || time - window.start >= 60_000) {
      window = { start: time, count: 0 };
      windows.set(key, window);
      // Limpieza ocasional para que el mapa no crezca con usuarios que ya no vuelven.
      if (windows.size > 5000) for (const [id, w] of windows) if (time - w.start >= 60_000) windows.delete(id);
    }
    window.count += 1;
    if (window.count > limitPerMinute) {
      res.set('Retry-After', String(Math.max(1, Math.ceil((window.start + 60_000 - time) / 1000))));
      return next(new ApiError(429, 'RATE_LIMITED', 'Demasiadas solicitudes seguidas. Espera un momento.'));
    }
    next();
  };
}
