import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { useAuth } from '../context/AuthContext';
import { deleteSession } from '../services/sessionsService';
import type { ReadingSessionWithId } from '../types/session';
import { getFirestoreErrorMessage } from '../utils/firestoreErrors';
import { withTimeout } from '../utils/withTimeout';
import { useBooks } from './useBooks';
import { useSessions } from './useSessions';

// Sin conexión, una escritura de Firestore no termina hasta recuperar la red: se corta la espera.
const WRITE_TIMEOUT_MS = 10000;

interface UseDeleteSessionResult {
  /** Pide confirmación y, si se acepta, elimina la sesión y deja el libro coherente (misma operación atómica). */
  confirmDelete: (session: ReadingSessionWithId) => void;
  /** Mensaje del último intento fallido; null si no hay. */
  error: string | null;
}

/**
 * Eliminar una sesión, igual en todas las pantallas (Calendario y detalle del libro). Usa las listas únicas de
 * libros y sesiones: `deleteSession` necesita el libro y las demás sesiones para recalcular el progreso.
 */
export function useDeleteSession(): UseDeleteSessionResult {
  const { user } = useAuth();
  const { books } = useBooks();
  const { sessions } = useSessions();
  const [error, setError] = useState<string | null>(null);

  // El aviso de confirmación se queda abierto mientras llegan datos: se lee siempre lo último, no lo de ese momento.
  const latest = useRef({ uid: user?.uid, books, sessions });
  latest.current = { uid: user?.uid, books, sessions };

  const run = useCallback(async (session: ReadingSessionWithId) => {
    const { uid, books: currentBooks, sessions: currentSessions } = latest.current;
    if (!uid) return;
    setError(null);
    try {
      const book = currentBooks.find((candidate) => candidate.id === session.bookId);
      await withTimeout(deleteSession(uid, session, book, currentSessions), WRITE_TIMEOUT_MS);
    } catch (e) {
      setError(getFirestoreErrorMessage(e));
    }
  }, []);

  const confirmDelete = useCallback(
    (session: ReadingSessionWithId) => {
      Alert.alert('¿Eliminar esta sesión?', 'El progreso del libro se ajusta solo.', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => run(session) },
      ]);
    },
    [run],
  );

  return { confirmDelete, error };
}
