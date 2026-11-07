import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { createApp } from '../../api/src/app';
import { initFirebase } from '../../api/src/firebase';
import { createApiClient, type ApiClient } from '../../src/services/apiClientCore';

/**
 * Arnés de las pruebas de extremo a extremo: levanta la API REAL de Lectoria en el mismo proceso (Express + Admin SDK
 * contra el emulador de Firestore) y le conecta el cliente HTTP REAL de la app. Así las pruebas ejercen el mismo camino
 * que la app —servicio de la app → HTTP → API → Firestore → suscripción en tiempo real— sin red externa ni Firebase Auth
 * (el «token» es `test-<uid>`).
 *
 * Los servicios de la app importan `api` de `services/apiClient`; las pruebas lo sustituyen por este (ver `jest.mock`).
 */
let client: ApiClient | undefined;
let server: Server | undefined;
let currentUid = 'alice';

/** El cliente que usan los servicios de la app durante la prueba. */
export const api = new Proxy({} as ApiClient, {
  get: (_target, property: string) => {
    if (!client) throw new Error('La API de pruebas no está iniciada: llama a startApi() en beforeAll.');
    return client[property as keyof ApiClient];
  },
});

export const API_URL = '';
export const warmUpApi = async () => true;

/** Quién hace las llamadas a la API (el `uid` del «token»). */
export function actAs(uid: string): void {
  currentUid = uid;
}

export async function startApi(): Promise<void> {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Se necesita el emulador de Firestore: npm run test:rules.');
  // Firebase Admin vive en las dependencias de api/: se inicializa desde allí (apunta al emulador por FIRESTORE_EMULATOR_HOST).
  const { db } = initFirebase({ projectId: 'demo-lectoria', serviceAccount: '' });
  const quiet = { warn() {}, error() {}, log() {} };
  const express = createApp({
    ctx: {
      db,
      now: () => new Date(),
      config: { openLibraryContact: '', googleBooksKey: '' },
      fetchFn: fetch,
      log: quiet,
    },
    verifyToken: async (token) => ({ uid: token.replace(/^test-/, '') }),
    rateLimitPerMinute: 1_000_000,
  });
  server = await new Promise<Server>((resolve) => {
    const listening = express.listen(0, '127.0.0.1', () => resolve(listening));
  });
  client = createApiClient({
    baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    getToken: async () => `test-${currentUid}`,
    timeoutMs: 10_000,
  });
}

export async function stopApi(): Promise<void> {
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  server = undefined;
  client = undefined;
}
