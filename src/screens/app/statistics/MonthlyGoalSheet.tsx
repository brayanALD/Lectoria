import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '../../../components/Button';
import { Sheet } from '../../../components/Sheet';
import { TextField } from '../../../components/TextField';
import { spacing } from '../../../theme/spacing';
import { getFirestoreErrorMessage } from '../../../utils/firestoreErrors';
import { MONTHLY_BOOKS_GOAL_LIMITS, parseMonthlyGoalInput } from '../../../utils/monthlyGoal';

interface MonthlyGoalSheetProps {
  visible: boolean;
  onClose: () => void;
  /** El objetivo actual (libros al mes), o `undefined` si no hay. */
  goal: number | undefined;
  /** Guarda el objetivo (o lo quita con `undefined`). Si falla, la hoja muestra el error y sigue abierta. */
  onSave: (goal: number | undefined) => Promise<void>;
}

/** Hoja para fijar, cambiar o quitar el objetivo mensual: cuántos libros terminar cada mes. */
export function MonthlyGoalSheet({ visible, onClose, goal, onSave }: MonthlyGoalSheetProps) {
  const [text, setText] = useState(goal === undefined ? '' : String(goal));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Cada vez que se abre arranca con el objetivo actual y sin errores.
  useEffect(() => {
    if (visible) {
      setText(goal === undefined ? '' : String(goal));
      setError(null);
    }
  }, [visible, goal]);

  const save = async (next: number | undefined) => {
    setError(null);
    setSaving(true);
    try {
      await onSave(next);
      onClose();
    } catch (e) {
      setError(getFirestoreErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    if (saving) return;
    const result = parseMonthlyGoalInput(text);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    return save(result.target);
  };

  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={styles.content}>
        <TextField
          label="Objetivo mensual (libros)"
          placeholder="2"
          value={text}
          onChangeText={(value) => {
            setText(value);
            setError(null);
          }}
          error={error ?? undefined}
          keyboardType="number-pad"
          maxLength={String(MONTHLY_BOOKS_GOAL_LIMITS.max).length}
          autoFocus
          selectTextOnFocus
          returnKeyType="done"
          onSubmitEditing={handleSave}
        />
        <Button title="Guardar" onPress={handleSave} loading={saving} />
        {goal !== undefined ? (
          <Button title="Quitar objetivo" variant="danger" onPress={() => !saving && save(undefined)} disabled={saving} />
        ) : null}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
});
