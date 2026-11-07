import { useCallback, useRef, useState } from 'react';

import { useAuth } from '../context/AuthContext';
import { deleteSession } from '../services/sessionsService';
import type { ReadingSessionWithId } from '../types/session';
import { showAlert } from '../components/alert';
import { getFirestoreErrorMessage } from '../utils/firestoreErrors';
import { withTimeout } from '../utils/withTimeout';

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
  const [error, setError] = useState<string | null>(null);

  // El aviso de confirmación se queda abierto mientras llegan datos: se lee siempre lo último, no lo de ese momento.
  const latest = useRef({ uid: user?.uid });
  latest.current = { uid: user?.uid };

  const run = useCallback(async (session: ReadingSessionWithId) => {
    if (!latest.current.uid) return;
    setError(null);
    try {
      // El servidor deja el libro coherente: él mismo lee las demás sesiones del libro.
      await withTimeout(deleteSession(session.id), WRITE_TIMEOUT_MS);
    } catch (e) {
      setError(getFirestoreErrorMessage(e));
    }
  }, []);

  const confirmDelete = useCallback(
    (session: ReadingSessionWithId) => {
      showAlert('¿Eliminar esta sesión?', 'El progreso del libro se ajusta solo.', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => run(session) },
      ]);
    },
    [run],
  );

  return { confirmDelete, error };
}
