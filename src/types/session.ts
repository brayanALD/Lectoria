import type { Timestamp } from 'firebase/firestore';

/** Sesión de lectura: users/{uid}/sessions/{sessionId}. Los límites de cada campo están en firestore.rules. */
export interface ReadingSession {
  bookId: string;
  /** Instante de la sesión. */
  date: Timestamp;
  /** «YYYY-MM-DD» en la zona horaria del dispositivo al registrarla; base del calendario y las rachas. */
  dateKey: string;
  startPage?: number;
  endPage?: number;
  pagesRead: number;
  durationMinutes: number;
  notes?: string;
  /** Lo fija el servidor (serverTimestamp()). */
  createdAt: Timestamp;
}

export type ReadingSessionWithId = ReadingSession & { id: string };

/** Datos validados de una sesión nueva, sin las marcas de tiempo que añade el servicio. */
export interface NewSessionFields {
  bookId: string;
  date: Date;
  dateKey: string;
  startPage?: number;
  endPage?: number;
  pagesRead: number;
  durationMinutes: number;
  notes?: string;
}

/** Valores del formulario «Registrar lectura»: todo texto salvo la fecha. */
export interface SessionFormValues {
  date: Date;
  minutes: string;
  /** Opcional: si se omite, se parte de la página actual del libro. */
  startPage: string;
  /** Página en la que se queda la persona. */
  endPage: string;
  notes: string;
}

export type SessionFormErrors = Partial<Record<keyof SessionFormValues | 'general', string>>;

export type SessionFormResult =
  | { ok: true; data: NewSessionFields }
  | { ok: false; errors: SessionFormErrors };

/** Lo mínimo que se necesita saber de un libro para validar y aplicar una sesión. */
export interface SessionBookContext {
  currentPage: number;
  pageCount?: number;
}
