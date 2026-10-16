import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';

import { BookForm } from '../../../components/BookForm';
import { useAuth } from '../../../context/AuthContext';
import { useBooks } from '../../../hooks/useBooks';
import type { AppStackParamList } from '../../../navigation/types';
import { findBookByIsbn } from '../../../services/bookCatalogService';
import { createBook } from '../../../services/booksService';
import { findDuplicateBook } from '../../../utils/bookDuplicates';
import { getFilterOptions } from '../../../utils/bookFilters';

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

export function AddBookScreen({ navigation, route }: Props) {
  const { user } = useAuth();
  const { books } = useBooks();
  const seriesNames = useMemo(() => getFilterOptions(books).series, [books]);
  // «Deseos» añade el libro a la lista de deseos; por defecto, a la biblioteca.
  const acquisition = route.params?.acquisition ?? 'owned';

  // El escáner devuelve el ISBN como parámetro. Se convierte en una petición con identificador y se borra el
  // parámetro, para que escanear el mismo libro otra vez vuelva a disparar la búsqueda.
  const [scan, setScan] = useState<{ isbn13: string; id: number }>();
  const scannedIsbn = route.params?.scannedIsbn;
  useEffect(() => {
    if (!scannedIsbn) return;
    setScan({ isbn13: scannedIsbn, id: Date.now() });
    navigation.setParams({ scannedIsbn: undefined });
  }, [scannedIsbn, navigation]);

  return (
    <BookForm
      submitLabel={acquisition === 'wishlist' ? 'Guardar en deseos' : 'Guardar libro'}
      acquisition={acquisition}
      seriesSuggestions={seriesNames}
      onLookup={(isbn13) => findBookByIsbn(isbn13)}
      onScan={() => navigation.navigate('ScanBook')}
      lookupRequest={scan}
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
