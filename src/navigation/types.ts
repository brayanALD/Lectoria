export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

// Las pantallas secundarias (detalle de libro, formularios, ajustes) se añadirán aquí.
export type AppStackParamList = {
  Tabs: undefined;
  AddBook: undefined;
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
