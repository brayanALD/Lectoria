import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { BookFormSkeleton } from '../../../components/BookSkeletons';
import { BookSelectionSheet } from '../../../components/BookSelectionSheet';
import { Button } from '../../../components/Button';
import { EmptyState } from '../../../components/EmptyState';
import { FormLayout } from '../../../components/FormLayout';
import { PickerRow } from '../../../components/PickerRow';
import { TextField } from '../../../components/TextField';
import { useAuth } from '../../../context/AuthContext';
import { makeStyles } from '../../../context/ThemeContext';
import { useBooks } from '../../../hooks/useBooks';
import { useCollections } from '../../../hooks/useCollections';
import type { AppStackParamList } from '../../../navigation/types';
import { createManualCollection, updateCollection } from '../../../services/collectionsService';
import type { CollectionWithId } from '../../../types/collection';
import { spacing } from '../../../theme/spacing';
import { fontFamily, fontSize } from '../../../theme/typography';
import { formatBookCount } from '../../../utils/book';
import {
  MAX_COLLECTION_NAME_LENGTH,
  parseBookSelection,
  parseCollectionName,
  toggleBookId,
  uniqueIds,
} from '../../../utils/collections';
import { getFirestoreErrorMessage } from '../../../utils/firestoreErrors';
import { withTimeout } from '../../../utils/withTimeout';

type Props = NativeStackScreenProps<AppStackParamList, 'CollectionForm'>;

// Sin conexión, una escritura de Firestore no termina hasta recuperar la red: se corta la espera.
const SAVE_TIMEOUT_MS = 10000;

/**
 * Crea una colección manual o edita una existente: su nombre y, si es manual, sus libros. Una estantería filtrada solo
 * cambia de nombre (sus filtros se guardan desde Biblioteca).
 */
export function CollectionFormScreen({ navigation, route }: Props) {
  const collectionId = route.params?.collectionId;
  const { collections, loading, error, retry } = useCollections();
  const { loading: booksLoading } = useBooks();

  if (loading || booksLoading) return <BookFormSkeleton />;

  if (error && collections.length === 0) {
    return (
      <EmptyState
        icon="cloud-offline-outline"
        title="No se pudieron cargar tus colecciones"
        description={error}
        action={{ label: 'Reintentar', onPress: retry }}
      />
    );
  }

  const existing = collectionId ? collections.find((collection) => collection.id === collectionId) : undefined;
  if (collectionId && !existing) {
    return <EmptyState icon="albums-outline" title="Esta colección ya no existe" action={{ label: 'Volver', onPress: () => navigation.goBack() }} />;
  }

  return (
    <Form
      existing={existing}
      collections={collections}
      onCreated={(id) => navigation.replace('CollectionDetail', { collectionId: id })}
      onSaved={() => navigation.goBack()}
    />
  );
}

interface FormProps {
  existing: CollectionWithId | undefined;
  collections: CollectionWithId[];
  onCreated: (collectionId: string) => void;
  onSaved: () => void;
}

function Form({ existing, collections, onCreated, onSaved }: FormProps) {
  const styles = useStyles();
  const { user } = useAuth();
  const { books } = useBooks();
  // Una colección nueva es manual; una estantería existente solo cambia de nombre.
  const manual = !existing || existing.kind === 'manual';
  // Se cargan una vez al abrir; lo que se escribe no se pisa con cambios que lleguen del servidor.
  const [name, setName] = useState(existing?.name ?? '');
  const [selectedIds, setSelectedIds] = useState<string[]>(() => uniqueIds(existing?.bookIds ?? []));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (saving) return;
    const parsedName = parseCollectionName(name, collections, existing?.id);
    const parsedBooks = manual ? parseBookSelection(selectedIds, books) : undefined;
    setNameError(parsedName.ok ? null : parsedName.error);
    setSelectionError(parsedBooks && !parsedBooks.ok ? parsedBooks.error : null);
    if (!parsedName.ok || (parsedBooks && !parsedBooks.ok)) return;

    setSubmitError(null);
    setSaving(true);
    try {
      if (!user) throw new Error('No hay sesión iniciada');
      const bookIds = parsedBooks?.ok ? parsedBooks.bookIds : undefined;
      if (existing) {
        await withTimeout(updateCollection(user.uid, existing.id, { name: parsedName.name, ...(bookIds ? { bookIds } : {}) }), SAVE_TIMEOUT_MS);
        onSaved();
      } else {
        const id = await withTimeout(createManualCollection(user.uid, parsedName.name, bookIds ?? []), SAVE_TIMEOUT_MS);
        onCreated(id);
      }
    } catch (e) {
      setSubmitError(getFirestoreErrorMessage(e));
      setSaving(false);
    }
  };

  return (
    <FormLayout>
      <TextField
        label="Nombre"
        placeholder="Para regalar, Verano…"
        value={name}
        onChangeText={(value) => {
          setName(value);
          setNameError(null);
        }}
        error={nameError ?? undefined}
        maxLength={MAX_COLLECTION_NAME_LENGTH}
        autoFocus={!existing}
        returnKeyType={manual ? 'next' : 'done'}
        onSubmitEditing={manual ? () => setPickerOpen(true) : handleSave}
        editable={!saving}
      />

      {manual ? (
        <PickerRow
          label="Libros"
          value={selectedIds.length === 0 ? 'Elegir libros' : formatBookCount(selectedIds.length)}
          icon="library-outline"
          onPress={() => setPickerOpen(true)}
          error={selectionError ?? undefined}
        />
      ) : null}

      {submitError ? (
        <Text style={styles.error} accessibilityRole="alert">
          {submitError}
        </Text>
      ) : null}

      <Button title="Guardar" onPress={handleSave} loading={saving} />

      <BookSelectionSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        books={books}
        selectedIds={selectedIds}
        onToggle={(bookId) => {
          setSelectedIds((ids) => toggleBookId(ids, bookId));
          setSelectionError(null);
        }}
      />
    </FormLayout>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  error: { fontSize: fontSize.sm, fontFamily: fontFamily.regular, color: colors.error, marginTop: spacing.xs },
}));
