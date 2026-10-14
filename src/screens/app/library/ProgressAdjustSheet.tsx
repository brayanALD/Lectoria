import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../../../components/Button';
import { Sheet } from '../../../components/Sheet';
import { TextField } from '../../../components/TextField';
import type { UserBookWithId } from '../../../types/book';
import { colors } from '../../../theme/colors';
import { spacing } from '../../../theme/spacing';
import { fontSize } from '../../../theme/typography';
import { getFirestoreErrorMessage } from '../../../utils/firestoreErrors';
import { parseProgressInput } from '../../../utils/session';

interface ProgressAdjustSheetProps {
  visible: boolean;
  onClose: () => void;
  book: UserBookWithId;
  /** Guarda la nueva página. Si falla, la hoja muestra el error y sigue abierta. */
  onSave: (page: number) => Promise<void>;
}

const MAX_DIGITS = 6;

/** Hoja para cambiar a mano la página en la que va un libro. */
export function ProgressAdjustSheet({ visible, onClose, book, onSave }: ProgressAdjustSheetProps) {
  const [text, setText] = useState(String(book.currentPage));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Cada vez que se abre arranca con la página actual y sin errores.
  useEffect(() => {
    if (visible) {
      setText(String(book.currentPage));
      setError(null);
    }
  }, [visible, book.currentPage]);

  const handleSave = async () => {
    if (saving) return;
    const result = parseProgressInput(text, book);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSave(result.page);
      onClose();
    } catch (e) {
      setError(getFirestoreErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={styles.content}>
        <TextField
          label="Página actual"
          value={text}
          onChangeText={(value) => {
            setText(value);
            setError(null);
          }}
          error={error ?? undefined}
          keyboardType="number-pad"
          maxLength={MAX_DIGITS}
          autoFocus
          selectTextOnFocus
          returnKeyType="done"
          onSubmitEditing={handleSave}
        />
        {book.pageCount ? <Text style={styles.total}>de {book.pageCount}</Text> : null}
        <Button title="Guardar" onPress={handleSave} loading={saving} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  total: { fontSize: fontSize.sm, color: colors.textSecondary },
});
