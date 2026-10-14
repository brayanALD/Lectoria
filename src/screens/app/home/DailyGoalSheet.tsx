import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '../../../components/Button';
import { Chip } from '../../../components/Chip';
import { Sheet } from '../../../components/Sheet';
import { TextField } from '../../../components/TextField';
import type { DailyGoal, GoalType } from '../../../types/goal';
import { spacing } from '../../../theme/spacing';
import { GOAL_LIMITS, GOAL_TYPE_LABELS, parseGoalInput } from '../../../utils/dailyGoal';
import { getFirestoreErrorMessage } from '../../../utils/firestoreErrors';

interface DailyGoalSheetProps {
  visible: boolean;
  onClose: () => void;
  /** La meta actual, o `undefined` si no hay. */
  goal: DailyGoal | undefined;
  /** Guarda la meta (o la quita con `undefined`). Si falla, la hoja muestra el error y sigue abierta. */
  onSave: (goal: DailyGoal | undefined) => Promise<void>;
}

const GOAL_TYPES: GoalType[] = ['minutes', 'pages'];
const PLACEHOLDERS: Record<GoalType, string> = { minutes: '30', pages: '20' };
const FIELD_LABELS: Record<GoalType, string> = { minutes: 'Meta diaria (minutos)', pages: 'Meta diaria (páginas)' };

/** Hoja para fijar, cambiar o quitar la meta diaria de lectura: se elige si se mide en minutos o en páginas. */
export function DailyGoalSheet({ visible, onClose, goal, onSave }: DailyGoalSheetProps) {
  const [type, setType] = useState<GoalType>(goal?.type ?? 'minutes');
  const [text, setText] = useState(goal ? String(goal.target) : '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Cada vez que se abre arranca con la meta actual (minutos si no hay) y sin errores.
  useEffect(() => {
    if (visible) {
      setType(goal?.type ?? 'minutes');
      setText(goal ? String(goal.target) : '');
      setError(null);
    }
  }, [visible, goal]);

  // Cambiar de tipo conserva el valor solo si es el de la meta actual: 30 minutos no es lo mismo que 30 páginas.
  const selectType = (next: GoalType) => {
    if (next === type || saving) return;
    setType(next);
    setText(goal?.type === next ? String(goal.target) : '');
    setError(null);
  };

  const save = async (next: DailyGoal | undefined) => {
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
    const result = parseGoalInput(text, type);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    return save({ type, target: result.target });
  };

  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={styles.content}>
        <View style={styles.types}>
          {GOAL_TYPES.map((option) => (
            <View key={option} style={styles.type}>
              <Chip label={GOAL_TYPE_LABELS[option]} selected={type === option} onPress={() => selectType(option)} />
            </View>
          ))}
        </View>
        <TextField
          label={FIELD_LABELS[type]}
          placeholder={PLACEHOLDERS[type]}
          value={text}
          onChangeText={(value) => {
            setText(value);
            setError(null);
          }}
          error={error ?? undefined}
          keyboardType="number-pad"
          maxLength={String(GOAL_LIMITS[type].max).length}
          autoFocus
          selectTextOnFocus
          returnKeyType="done"
          onSubmitEditing={handleSave}
        />
        <Button title="Guardar" onPress={handleSave} loading={saving} />
        {goal ? <Button title="Quitar meta" variant="danger" onPress={() => !saving && save(undefined)} disabled={saving} /> : null}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  types: { flexDirection: 'row', gap: spacing.sm },
  type: { flex: 1 },
});
