import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../../../components/Button';
import { Sheet } from '../../../components/Sheet';
import { TextField } from '../../../components/TextField';
import { useAuth } from '../../../context/AuthContext';
import { makeStyles } from '../../../context/ThemeContext';
import { useCollections } from '../../../hooks/useCollections';
import { createFilterCollection } from '../../../services/collectionsService';
import type { CollectionFilters } from '../../../types/collection';
import { spacing } from '../../../theme/spacing';
import { fontFamily, fontSize } from '../../../theme/typography';
import { MAX_COLLECTION_NAME_LENGTH, describeFilters, parseCollectionName } from '../../../utils/collections';
import { getFirestoreErrorMessage } from '../../../utils/firestoreErrors';
import { withTimeout } from '../../../utils/withTimeout';

interface SaveShelfSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Los filtros de Biblioteca que se guardan. */
  filters: CollectionFilters;
  /** Recibe el id de la estantería creada. */
  onSaved: (collectionId: string) => void;
}

// Sin conexión, una escritura de Firestore no termina hasta recuperar la red: se corta la espera.
const SAVE_TIMEOUT_MS = 10000;

/** Guardar la búsqueda y los filtros actuales de Biblioteca como una estantería con nombre. */
export function SaveShelfSheet({ visible, onClose, filters, onSaved }: SaveShelfSheetProps) {
  const styles = useStyles();
  const { user } = useAuth();
  const { collections } = useCollections();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Cada vez que se abre arranca limpia.
  useEffect(() => {
    if (visible) {
      setName('');
      setError(null);
    }
  }, [visible]);

  const handleSave = async () => {
    if (saving) return;
    const parsed = parseCollectionName(name, collections);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      if (!user) throw new Error('No hay sesión iniciada');
      const id = await withTimeout(createFilterCollection(user.uid, parsed.name, filters), SAVE_TIMEOUT_MS);
      onClose();
      onSaved(id);
    } catch (e) {
      setError(getFirestoreErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={saving ? () => {} : onClose}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          Guardar estantería
        </Text>
        <Text style={styles.filters}>{describeFilters(filters)}</Text>
      </View>
      <TextField
        label="Nombre"
        placeholder="Fantasía sin leer…"
        value={name}
        onChangeText={(value) => {
          setName(value);
          setError(null);
        }}
        error={error ?? undefined}
        maxLength={MAX_COLLECTION_NAME_LENGTH}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={handleSave}
        editable={!saving}
      />
      <Button title="Guardar" onPress={handleSave} loading={saving} />
    </Sheet>
  );
}

const useStyles = makeStyles((colors) => StyleSheet.create({
  header: { gap: spacing.xs },
  title: { fontSize: fontSize.lg, fontFamily: fontFamily.display, color: colors.textPrimary },
  filters: { fontSize: fontSize.sm, fontFamily: fontFamily.regular, color: colors.textSecondary },
}));
