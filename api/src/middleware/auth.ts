import type { NextFunction, Request, Response } from 'express';

import { unauthenticated } from '../errors';

/** El usuario que hace la solicitud, ya verificado. Toda la API trabaja solo sobre `users/{uid}`. */
export interface AuthUser {
  uid: string;
  email: string;
  name: string;
}

export type VerifyToken = (idToken: string) => Promise<{ uid: string; email?: string; name?: string }>;

declare module 'express-serve-static-core' {
  interface Request {
    user: AuthUser;
  }
}

/**
 * Verifica el ID token de Firebase Auth (`Authorization: Bearer <token>`) y deja el usuario en `req.user`.
 * No hay roles: cada persona solo puede tocar su propia biblioteca, porque la ruta de cada documento sale del `uid`
 * del token y nunca de lo que envíe el cliente.
 */
export function authenticate(verifyToken: VerifyToken) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const token = /^Bearer\s+(.+)$/i.exec(req.get('authorization') || '')?.[1];
    if (!token) return next(unauthenticated());
    try {
      const decoded = await verifyToken(token);
      req.user = { uid: decoded.uid, email: decoded.email ?? '', name: decoded.name ?? '' };
      next();
    } catch {
      next(unauthenticated('La sesión no es válida o expiró. Inicia sesión de nuevo.'));
    }
  };
}
