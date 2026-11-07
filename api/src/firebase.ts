import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

import type { Config } from './config';

/** Lee la clave de la cuenta de servicio: JSON en una línea o ese mismo JSON en base64. */
export function parseServiceAccount(text: string) {
  const trimmed = text.trim();
  const json = trimmed.startsWith('{') ? trimmed : Buffer.from(trimmed, 'base64').toString('utf8');
  return JSON.parse(json);
}

// Credenciales: FIREBASE_SERVICE_ACCOUNT o las predeterminadas del entorno (GOOGLE_APPLICATION_CREDENTIALS).
// Con FIRESTORE_EMULATOR_HOST no hacen falta.
export function initFirebase(config: Pick<Config, 'projectId' | 'serviceAccount'>) {
  const app =
    getApps()[0] ??
    initializeApp({
      ...(config.projectId ? { projectId: config.projectId } : {}),
      ...(config.serviceAccount ? { credential: cert(parseServiceAccount(config.serviceAccount)) } : {}),
    });
  return { app, db: getFirestore(app), auth: getAuth(app) };
}
