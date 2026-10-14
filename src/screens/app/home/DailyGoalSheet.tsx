import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '../../../components/Button';
import { Sheet } from '../../../components/Sheet';
import { TextField } from '../../../components/TextField';
import { spacing } from '../../../theme/spacing';
import { MAX_DAILY_GOAL_MINUTES, parseGoalInput } from '../../../utils/dailyGoal';
import { getFirestoreErrorMessage } from '../../../utils/firestoreErrors';

interface DailyGoalSheetProps {
  visible: boolean;
  onClose: () => void;
  /** La meta actual en minutos, o `undefined` si no hay. */
  goalMinutes: number | undefined;
  /** Guarda la meta (o la quita con `undefined`). Si falla, la hoja muestra el error y sigue abierta. */
  onSave: (minutes: number | undefined) => Promise<void>;
}

const MAX_DIGITS = String(MAX_DAILY_GOAL_MINUTES).length;

/** Hoja para fijar, cambiar o quitar la meta diaria de lectura, en minutos. */
export function DailyGoalSheet({ visible, onClose, goalMinutes, onSave }: DailyGoalSheetProps) {
  const [text, setText] = useState(goalMinutes === undefined ? '' : String(goalMinutes));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Cada vez que se abre arranca con la meta actual y sin errores.
  useEffect(() => {
    if (visible) {
      setText(goalMinutes === undefined ? '' : String(goalMinutes));
      setError(null);
    }
  }, [visible, goalMinutes]);

  const save = async (minutes: number | undefined) => {
    setError(null);
    setSaving(true);
    try {
      await onSave(minutes);
      onClose();
    } catch (e) {
      setError(getFirestoreErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    if (saving) return;
    const result = parseGoalInput(text);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    return save(result.minutes);
  };

  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={styles.content}>
        <TextField
          label="Meta diaria (minutos)"
          placeholder="30"
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
        <Button title="Guardar" onPress={handleSave} loading={saving} />
        {goalMinutes !== undefined ? (
          <Button title="Quitar meta" variant="danger" onPress={() => !saving && save(undefined)} disabled={saving} />
        ) : null}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
});
