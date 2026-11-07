import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

import { createApp } from '../../src/app';
import type { Ctx } from '../../src/context';

const PROJECT = 'demo-lectoria';

export interface Response {
  status: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any;
}

/** Cliente de pruebas de una persona: cada llamada lleva su «token» (`test-<uid>`). */
export interface Client {
  uid: string;
  get: (path: string) => Promise<Response>;
  post: (path: string, body?: unknown) => Promise<Response>;
  put: (path: string, body?: unknown) => Promise<Response>;
  patch: (path: string, body?: unknown) => Promise<Response>;
  delete: (path: string) => Promise<Response>;
}

export interface TestEnv {
  db: Firestore;
  /** Dirección del servidor de pruebas, para enviar cuerpos que el cliente de pruebas no produciría. */
  base: string;
  /** Cambia la hora que ve la API. */
  setNow: (date: Date) => void;
  /** Respuestas de `fetch` hacia los catálogos externos. */
  setFetch: (fn: typeof fetch) => void;
  setConfig: (config: Partial<Ctx['config']>) => void;
  client: (uid: string) => Client;
  /** Una solicitud sin sesión o con un token concreto. */
  raw: (method: string, path: string, headers?: Record<string, string>, body?: unknown) => Promise<Response>;
  clear: () => Promise<void>;
  close: () => Promise<void>;
}

export const BASE_NOW = new Date('2026-10-13T15:00:00.000Z');

export async function startEnv(options: { rateLimitPerMinute?: number } = {}): Promise<TestEnv> {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error('Las pruebas de integración necesitan el emulador: npm run test:api (desde la raíz).');
  }
  const app = getApps()[0] ?? initializeApp({ projectId: PROJECT });
  const db = getFirestore(app);

  let now = BASE_NOW;
  let fetchFn: typeof fetch = async () => {
    throw new Error('Sin red en las pruebas');
  };
  const config: Ctx['config'] = { openLibraryContact: '', googleBooksKey: '' };
  const quiet = { warn() {}, error() {}, log() {} };

  const ctx: Ctx = {
    db,
    now: () => now,
    config,
    fetchFn: (...args) => fetchFn(...args),
    log: quiet,
  };
  const express = createApp({
    ctx,
    verifyToken: async (token) => {
      if (!token.startsWith('test-')) throw new Error('token inválido');
      const uid = token.slice(5);
      return { uid, email: `${uid}@correo.test`, name: '' };
    },
    // Sin límite práctico salvo que la prueba lo pida: todas las pruebas de un archivo usan las mismas personas.
    rateLimitPerMinute: options.rateLimitPerMinute ?? 1_000_000,
  });
  const server: Server = await new Promise((resolve) => {
    const s = express.listen(0, '127.0.0.1', () => resolve(s));
  });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const raw: TestEnv['raw'] = async (method, path, headers = {}, body) => {
    const response = await fetch(base + path, {
      method,
      headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }
    return { status: response.status, body: parsed };
  };

  const client = (uid: string): Client => {
    const call = (method: string) => (path: string, body?: unknown) =>
      raw(method, path, { Authorization: `Bearer test-${uid}` }, body);
    return {
      uid,
      get: (path) => call('GET')(path),
      post: call('POST'),
      put: call('PUT'),
      patch: call('PATCH'),
      delete: (path) => call('DELETE')(path),
    };
  };

  return {
    db,
    base,
    setNow: (date) => {
      now = date;
    },
    setFetch: (fn) => {
      fetchFn = fn;
    },
    setConfig: (changes) => Object.assign(config, changes),
    client,
    raw,
    clear: async () => {
      await db.recursiveDelete(db.collection('users'));
      now = BASE_NOW;
    },
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

/** Crea el perfil de la persona (lo hace la app en cada inicio de sesión). */
export async function createProfile(c: Client, timeZone = 'America/Bogota'): Promise<void> {
  const res = await c.post('/v1/me/profile', { displayName: 'Ana', timeZone });
  if (res.status !== 201) throw new Error(`No se pudo crear el perfil: ${res.status}`);
}

/** Crea un libro y devuelve su id. */
export async function createBook(c: Client, fields: Record<string, unknown> = {}): Promise<string> {
  const res = await c.post('/v1/books', { title: 'Dune', authors: ['Frank Herbert'], pageCount: 400, ...fields });
  if (res.status !== 201) throw new Error(`No se pudo crear el libro: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.id;
}

export async function readDoc(db: Firestore, path: string) {
  const snap = await db.doc(path).get();
  return snap.exists ? snap.data()! : undefined;
}
