import { api } from './apiClient';

/**
 * Elimina todos los datos de la cuenta: sus libros, lecturas, colecciones y, al final, el perfil (`users/{uid}`). El
 * servidor lo hace con un borrado recursivo, así que también alcanza cualquier subcolección que se añada en el futuro
 * (Firestore no borra las subcolecciones solas). Es idempotente: si se interrumpe, se puede repetir. No elimina el usuario
 * de Authentication: eso lo hace la app después, con la sesión aún iniciada y tras confirmar la identidad.
 */
export async function deleteAccountData(): Promise<void> {
  // Borrar una biblioteca grande tarda: tiempo máximo mayor que el de una escritura normal.
  await api.delete('/v1/me/data', { timeoutMs: 90_000 });
}
