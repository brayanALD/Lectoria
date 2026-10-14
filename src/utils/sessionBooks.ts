import type { ReadingStatus } from '../types/book';

/** Lo que se necesita de un libro para ordenarlo (sin depender de Firebase: `updatedAt` es un Timestamp). */
interface SortableBook {
  status: ReadingStatus;
  title: string;
  updatedAt: { toMillis(): number };
}

// Primero lo que se está leyendo; los libros terminados, al final.
const STATUS_ORDER: Record<ReadingStatus, number> = {
  reading: 0,
  paused: 1,
  want_to_read: 2,
  abandoned: 3,
  finished: 4,
};

/** Libros en el orden en que conviene ofrecerlos al registrar una lectura: por estado y, dentro, el más reciente primero. */
export function sortBooksForSession<T extends SortableBook>(books: readonly T[]): T[] {
  return [...books].sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
      b.updatedAt.toMillis() - a.updatedAt.toMillis() ||
      a.title.localeCompare(b.title, 'es', { sensitivity: 'base' }),
  );
}

/** El libro que se preselecciona: el que se está leyendo y se tocó más recientemente; si no, el primero del orden. */
export function pickDefaultBook<T extends SortableBook>(books: readonly T[]): T | undefined {
  return sortBooksForSession(books)[0];
}
