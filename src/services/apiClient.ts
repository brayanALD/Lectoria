import { auth } from '../../firebaseConfig';
import { createApiClient } from './apiClientCore';

// Único punto de salida hacia la API de Lectoria: añade el ID token de Firebase Auth a cada solicitud. Las escrituras de
// la app (libros, lecturas, colecciones, metas, cuenta) y la búsqueda por ISBN pasan por aquí; las lecturas en tiempo
// real siguen yendo directo a Firestore (ver CLAUDE.md). Expo solo sustituye `process.env.EXPO_PUBLIC_*` si se escribe
// de forma literal.
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

export const api = createApiClient({
  baseUrl: API_URL,
  getToken: async () => {
    const user = auth.currentUser;
    if (!user) throw Object.assign(new Error('Sin sesión'), { code: 'auth/no-user' });
    return user.getIdToken();
  },
});

/** Despierta la API si estaba dormida (el hosting gratuito la duerme tras unos minutos sin tráfico). Nunca lanza. */
export const warmUpApi = (): Promise<boolean> => api.ping();
