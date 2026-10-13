import type { Timestamp } from 'firebase/firestore';

export type ReadingStatus = 'want_to_read' | 'reading' | 'paused' | 'finished' | 'abandoned';

/** `wishlist` = deseado, aún sin tenerlo (versión 1.1); `owned` = en la biblioteca. */
export type Acquisition = 'wishlist' | 'owned';

/** Libro personal: users/{uid}/books/{bookId}. Los límites de cada campo están en firestore.rules. */
export interface UserBook {
  title: string;
  authors: string[];
  genres?: string[];
  seriesName?: string;
  seriesOrder?: number;
  isbn13?: string;
  coverUrl?: string;
  pageCount?: number;

  status: ReadingStatus;
  acquisition: Acquisition;
  currentPage: number;
  rating?: 1 | 2 | 3 | 4 | 5;
  review?: string;
  notes?: string;

  startedAt?: Timestamp;
  finishedAt?: Timestamp;
  /** Los fija el servidor (serverTimestamp()); las reglas exigen que coincidan con request.time. */
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** Un libro leído de Firestore, con el id de su documento. */
export type UserBookWithId = UserBook & { id: string };

/** Campos que se escriben al crear un libro desde el formulario (sin fechas de control). */
export type NewBookFields = Pick<UserBook, 'title' | 'authors' | 'status' | 'acquisition' | 'currentPage'> &
  Partial<Pick<UserBook, 'genres' | 'seriesName' | 'seriesOrder' | 'pageCount' | 'isbn13' | 'coverUrl'>>;

/** Datos de un libro obtenidos de un catálogo externo (Open Library) a partir de su ISBN. */
export interface CatalogBook {
  isbn13: string;
  title: string;
  authors: string[];
  pageCount?: number;
  coverUrl?: string;
}

/** Valores del formulario «Añadir libro»: todo texto, tal como lo escribe el usuario. */
export interface BookFormValues {
  /** ISBN-10 o ISBN-13, con o sin guiones; se guarda normalizado a ISBN-13. Opcional. */
  isbn13: string;
  /** Portada obtenida del catálogo; no se escribe a mano. */
  coverUrl: string;
  title: string;
  /** Varios autores separados por coma o punto y coma. */
  authors: string;
  pageCount: string;
  /** Varios géneros separados por coma o punto y coma. */
  genres: string;
  seriesName: string;
  seriesOrder: string;
  status: ReadingStatus;
}

export type BookFormErrors = Partial<Record<keyof BookFormValues, string>>;

export type BookFormResult =
  | { ok: true; data: NewBookFields }
  | { ok: false; errors: BookFormErrors };
