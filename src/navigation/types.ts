export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

// Las pantallas secundarias (detalle de libro, formularios, ajustes) se añadirán aquí.
export type AppStackParamList = {
  Tabs: undefined;
  /** `scannedIsbn`: ISBN-13 devuelto por el escáner; el formulario lo busca al recibirlo. */
  AddBook: { scannedIsbn?: string } | undefined;
  ScanBook: undefined;
  /** `bookId`: libro fijo (desde su detalle). Sin él (desde Inicio) se preselecciona uno y se puede cambiar. */
  AddSession: { bookId?: string } | undefined;
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
