import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Alert } from 'react-native';

import { BookForm } from '../../../components/BookForm';
import { useAuth } from '../../../context/AuthContext';
import { useBooks } from '../../../hooks/useBooks';
import type { AppStackParamList } from '../../../navigation/types';
import { findBookByIsbn } from '../../../services/bookCatalogService';
import { createBook } from '../../../services/booksService';
import { findDuplicateBook } from '../../../utils/bookDuplicates';

type Props = NativeStackScreenProps<AppStackParamList, 'AddBook'>;

/** Pregunta si se añade un libro que ya está en la biblioteca. Descartar el aviso equivale a cancelar. */
function confirmDuplicate(title: string): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      `Ya tienes «${title}»`,
      '¿Añadirlo de todos modos?',
      [
        { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Añadir', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

export function AddBookScreen({ navigation }: Props) {
  const { user } = useAuth();
  const { books } = useBooks();

  return (
    <BookForm
      submitLabel="Guardar libro"
      onLookup={(isbn13) => findBookByIsbn(isbn13)}
      confirm={async (fields) => {
        const duplicate = findDuplicateBook(books, fields);
        return duplicate ? confirmDuplicate(duplicate.title) : true;
      }}
      onSubmit={async (fields) => {
        if (!user) throw new Error('No hay sesión iniciada');
        await createBook(user.uid, fields);
      }}
      onSaved={() => navigation.goBack()}
    />
  );
}
