import type { Firestore } from 'firebase-admin/firestore';

import type { Config } from './config';

/**
 * Lo externo que usan los servicios, inyectado para poder probarlos sin red: la base de datos, el reloj y el registro.
 * `fetchFn` es la salida a los catálogos de libros.
 */
export interface Ctx {
  db: Firestore;
  now: () => Date;
  config: Pick<Config, 'openLibraryContact' | 'googleBooksKey'>;
  fetchFn: typeof fetch;
  log: Pick<Console, 'warn' | 'error' | 'log'>;
}

export const userRef = (ctx: Ctx, uid: string) => ctx.db.collection('users').doc(uid);
export const booksRef = (ctx: Ctx, uid: string) => userRef(ctx, uid).collection('books');
export const sessionsRef = (ctx: Ctx, uid: string) => userRef(ctx, uid).collection('sessions');
export const collectionsRef = (ctx: Ctx, uid: string) => userRef(ctx, uid).collection('collections');
