import express, { Router } from 'express';

import type { Ctx } from './context';
import { DEFAULT_RATE_LIMIT_PER_MINUTE } from './config';
import { notFound } from './errors';
import { authenticate, type VerifyToken } from './middleware/auth';
import { handleErrors, routeNotFound } from './middleware/errors';
import { rateLimit } from './middleware/rateLimit';
import * as books from './services/books';
import * as catalog from './services/catalog';
import * as collections from './services/collections';
import * as profile from './services/profile';
import * as sessions from './services/sessions';

export interface AppOptions {
  ctx: Ctx;
  verifyToken: VerifyToken;
  corsOrigins?: string[];
  rateLimitPerMinute?: number;
}

/** Los identificadores de documento de Firestore que genera la app: `addDoc` y los `requestId`. */
const ID = /^[A-Za-z0-9_-]{1,128}$/;

/**
 * Crea la aplicación Express. Todo lo externo se inyecta (base de datos, reloj, verificación del token y salida al
 * catálogo) para poder probarla sin red.
 *
 * Contrato: todas las rutas de `/v1` (salvo `/v1/salud`) exigen `Authorization: Bearer <ID token de Firebase>` y solo
 * tocan la biblioteca de esa persona. La app **lee** de Firestore en tiempo real (reglas de solo lectura) y **escribe**
 * aquí. Las escrituras que crean algo aceptan un `requestId` para que reintentarlas no las duplique.
 */
export function createApp({ ctx, verifyToken, corsOrigins = [], rateLimitPerMinute = DEFAULT_RATE_LIMIT_PER_MINUTE }: AppOptions) {
  const app = express();
  app.disable('x-powered-by');
  // Render termina TLS delante del servidor.
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '100kb' }));

  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Cache-Control', 'no-store');
    const origin = req.get('origin');
    if (origin && corsOrigins.includes(origin)) {
      res.set('Access-Control-Allow-Origin', origin);
      res.set('Vary', 'Origin');
      res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      if (req.method === 'OPTIONS') return void res.sendStatus(204);
    }
    next();
  });

  // Sin datos ni sesión: sirve a Render y a la app para saber si la API está viva (y para despertarla).
  app.get('/v1/salud', (_req, res) => void res.json({ status: 'ok' }));

  const v1 = Router();
  v1.use(authenticate(verifyToken));
  v1.use(rateLimit(rateLimitPerMinute));
  v1.param('id', (_req, _res, next, id) => (ID.test(String(id)) ? next() : next(notFound())));

  // ---- Perfil, metas y cuenta ----
  v1.get('/me', (req, res) => void res.json({ uid: req.user.uid }));
  v1.post('/me/profile', async (req, res) => {
    const { created } = await profile.ensureProfile(ctx, req.user, req.body);
    res.status(created ? 201 : 200).json({ created });
  });
  v1.put('/me/daily-goal', async (req, res) => {
    await profile.setDailyGoal(ctx, req.user.uid, req.body);
    res.status(204).end();
  });
  v1.delete('/me/daily-goal', async (req, res) => {
    await profile.clearDailyGoal(ctx, req.user.uid);
    res.status(204).end();
  });
  v1.put('/me/monthly-goal', async (req, res) => {
    await profile.setMonthlyBooksGoal(ctx, req.user.uid, req.body);
    res.status(204).end();
  });
  v1.delete('/me/monthly-goal', async (req, res) => {
    await profile.clearMonthlyBooksGoal(ctx, req.user.uid);
    res.status(204).end();
  });
  v1.delete('/me/data', async (req, res) => {
    await profile.deleteAccountData(ctx, req.user.uid);
    res.status(204).end();
  });

  // ---- Catálogo por ISBN ----
  v1.get('/catalog/isbn/:isbn', async (req, res) => {
    res.json(await catalog.findBookByIsbn(ctx, String(req.params.isbn)));
  });

  // ---- Libros ----
  v1.post('/books', async (req, res) => {
    const created = await books.createBook(ctx, req.user.uid, req.body);
    res.status(created.repeated ? 200 : 201).json(created);
  });
  v1.patch('/books/:id', async (req, res) => {
    await books.updateBookDetails(ctx, req.user.uid, String(req.params.id), req.body);
    res.status(204).end();
  });
  v1.put('/books/:id/status', async (req, res) => {
    await books.changeBookStatus(ctx, req.user.uid, String(req.params.id), req.body);
    res.status(204).end();
  });
  v1.post('/books/:id/finish', async (req, res) => {
    await sessions.finishBook(ctx, req.user.uid, String(req.params.id), req.body);
    res.status(204).end();
  });
  v1.post('/books/:id/progress', async (req, res) => {
    await sessions.adjustBookProgress(ctx, req.user.uid, String(req.params.id), req.body);
    res.status(204).end();
  });
  v1.put('/books/:id/purchase', async (req, res) => {
    await books.savePurchase(ctx, req.user.uid, String(req.params.id), req.body);
    res.status(204).end();
  });
  v1.put('/books/:id/notes', async (req, res) => {
    await books.saveBookNotes(ctx, req.user.uid, String(req.params.id), req.body);
    res.status(204).end();
  });
  v1.put('/books/:id/review', async (req, res) => {
    await books.saveBookReview(ctx, req.user.uid, String(req.params.id), req.body);
    res.status(204).end();
  });
  v1.delete('/books/:id', async (req, res) => {
    res.json({ deletedSessions: await books.deleteBook(ctx, req.user.uid, String(req.params.id)) });
  });

  // ---- Sesiones de lectura ----
  v1.post('/sessions', async (req, res) => {
    const created = await sessions.createSession(ctx, req.user.uid, req.body);
    res.status(created.repeated ? 200 : 201).json(created);
  });
  v1.put('/sessions/:id', async (req, res) => {
    await sessions.updateSession(ctx, req.user.uid, String(req.params.id), req.body);
    res.status(204).end();
  });
  v1.delete('/sessions/:id', async (req, res) => {
    await sessions.deleteSession(ctx, req.user.uid, String(req.params.id));
    res.status(204).end();
  });

  // ---- Colecciones y estanterías ----
  v1.post('/collections', async (req, res) => {
    const created = await collections.createCollection(ctx, req.user.uid, req.body);
    res.status(created.repeated ? 200 : 201).json(created);
  });
  v1.patch('/collections/:id', async (req, res) => {
    await collections.updateCollection(ctx, req.user.uid, String(req.params.id), req.body);
    res.status(204).end();
  });
  v1.delete('/collections/:id', async (req, res) => {
    await collections.deleteCollection(ctx, req.user.uid, String(req.params.id));
    res.status(204).end();
  });

  app.use('/v1', v1);
  app.use(routeNotFound);
  app.use(handleErrors(ctx.log));
  return app;
}
