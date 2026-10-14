/** Estado de una lista en tiempo real que consume la interfaz: cargando, con datos o con error. */
export interface ListState<T> {
  items: T[];
  /** true hasta recibir la primera respuesta de Firestore. */
  loading: boolean;
  error: string | null;
}

export type ListAction<T> =
  | { type: 'subscribe' }
  | { type: 'idle' }
  | { type: 'success'; items: T[] }
  | { type: 'failure'; message: string };

export function initialListState<T>(): ListState<T> {
  return { items: [], loading: true, error: null };
}

export function listReducer<T>(state: ListState<T>, action: ListAction<T>): ListState<T> {
  switch (action.type) {
    // Nueva suscripción (primer uso, cambio de usuario o reintento): se vacía la lista para no mostrar
    // nunca los datos de otro usuario mientras llegan los nuevos.
    case 'subscribe':
      return initialListState<T>();
    // Sin sesión: no hay nada que cargar.
    case 'idle':
      return { items: [], loading: false, error: null };
    case 'success':
      return { items: action.items, loading: false, error: null };
    // Ante un error se conservan los últimos datos recibidos, por si ya se estaban mostrando.
    case 'failure':
      return { ...state, loading: false, error: action.message };
  }
}
