import type { Timestamp } from 'firebase/firestore';

export type ReadingStatus = 'want_to_read' | 'reading' | 'paused' | 'finished' | 'abandoned';

/** `wishlist` = deseado, aún sin tenerlo (versión 1.1); `owned` = en la biblioteca. */
export type Acquisition = 'wishlist' | 'owned';

/**
 * Una reseña específica: sobre un aspecto concreto del libro (los personajes, la trama, el final…). El tema lo escribe
 * la persona con sus palabras: no hay una lista cerrada que la limite.
 */
export interface SpecificReview {
  topic: string;
  text: string;
}

/** La reseña de un libro: todo es opcional. Sin calificación, `rating` no existe (nunca vale 0). */
export interface ReviewFields {
  /** De 0,5 a 5 estrellas, de media en media. */
  rating?: number;
  /** Opinión general. */
  review?: string;
  /** Reseñas por tema, en el orden en que se escribieron (sin temas repetidos). */
  specificReviews?: SpecificReview[];
}

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
  /** Reseña (de 0,5 a 5 estrellas, de media en media), opinión general y reseñas por tema: ver `ReviewFields`. */
  rating?: number;
  review?: string;
  specificReviews?: SpecificReview[];
  /** Notas personales sobre la lectura (ideas, fragmentos…): independientes de la reseña. */
  notes?: string;
  /** Datos de la compra (solo en libros propios): se guardan al marcar un deseo como comprado. Sin moneda. */
  price?: number;
  purchasedAt?: Timestamp;

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

/** Datos de una compra, tal como se guardan: la fecha es obligatoria y el precio, opcional. */
export interface PurchaseFields {
  purchasedAt: Date;
  price?: number;
}

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
