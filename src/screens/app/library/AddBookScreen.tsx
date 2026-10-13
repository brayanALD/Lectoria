import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { BookForm } from '../../../components/BookForm';
import { useAuth } from '../../../context/AuthContext';
import type { AppStackParamList } from '../../../navigation/types';
import { createBook } from '../../../services/booksService';

type Props = NativeStackScreenProps<AppStackParamList, 'AddBook'>;

export function AddBookScreen({ navigation }: Props) {
  const { user } = useAuth();

  return (
    <BookForm
      submitLabel="Guardar libro"
      onSubmit={async (fields) => {
        if (!user) throw new Error('No hay sesión iniciada');
        await createBook(user.uid, fields);
      }}
      onSaved={() => navigation.goBack()}
    />
  );
}
