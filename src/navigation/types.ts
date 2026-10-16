import type { Acquisition } from '../types/book';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

// Las pantallas secundarias (detalle de libro, formularios, ajustes) se añadirán aquí.
export type AppStackParamList = {
  Tabs: undefined;
  /**
   * `scannedIsbn`: ISBN-13 devuelto por el escáner; el formulario lo busca al recibirlo.
   * `acquisition`: `wishlist` añade el libro a la lista de deseos (sin estado de lectura); por defecto, `owned`.
   */
  AddBook: { scannedIsbn?: string; acquisition?: Acquisition } | undefined;
  ScanBook: undefined;
  /**
   * `bookId`: libro fijo (desde su detalle). Sin él (desde Inicio) se preselecciona uno y se puede cambiar.
   * `sessionId`: edita esa sesión en lugar de registrar una nueva (el libro es el suyo y no se puede cambiar).
   * `day`: día preseleccionado («YYYY-MM-DD», p. ej. el elegido en el Calendario); un día futuro se ignora.
   * `fromTimer`: registra la lectura medida por el cronómetro (su libro, sus minutos y su día de inicio).
   */
  AddSession: { bookId?: string; sessionId?: string; day?: string; fromTimer?: boolean } | undefined;
  Timer: undefined;
  BookDetail: { bookId: string };
  EditBook: { bookId: string };
};

export type TabParamList = {
  Home: undefined;
  Library: undefined;
  Calendar: undefined;
  Statistics: undefined;
  Profile: undefined;
};
