import { collection, deleteDoc, doc, getDocs, writeBatch, type Firestore } from 'firebase/firestore';

import { db } from '../../firebaseConfig';

// Firestore admite 500 operaciones por lote; se deja margen.
const BATCH_SIZE = 400;
// Firestore no borra las subcolecciones al borrar el documento padre (plan, sección 7): se borran una por una.
const SUBCOLLECTIONS = ['sessions', 'books', 'collections'] as const;

/**
 * Elimina todos los datos de la cuenta: sus lecturas, sus libros, sus colecciones y, al final, el perfil (`users/{uid}`). Es idempotente:
 * si se interrumpe, se puede repetir y borra lo que quede. No elimina el usuario de Authentication (eso va después, con
 * la sesión aún iniciada, porque sin ella las reglas ya no dejarían borrar nada). El parámetro `database` permite
 * probarlo contra el emulador; en la app siempre se usa `db`.
 */
export async function deleteAccountData(uid: string, database: Firestore = db): Promise<void> {
  for (const name of SUBCOLLECTIONS) {
    const snapshot = await getDocs(collection(database, 'users', uid, name));
    for (let start = 0; start < snapshot.docs.length; start += BATCH_SIZE) {
      const batch = writeBatch(database);
      for (const item of snapshot.docs.slice(start, start + BATCH_SIZE)) batch.delete(item.ref);
      await batch.commit();
    }
  }
  await deleteDoc(doc(database, 'users', uid));
}
