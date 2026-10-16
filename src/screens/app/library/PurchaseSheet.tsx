import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '../../../components/Button';
import { MonthCalendar } from '../../../components/MonthCalendar';
import { PickerRow } from '../../../components/PickerRow';
import { Sheet } from '../../../components/Sheet';
import { TextField } from '../../../components/TextField';
import type { PurchaseFields } from '../../../types/book';
import { spacing } from '../../../theme/spacing';
import { formatDayLabel, monthOf, type YearMonth } from '../../../utils/calendar';
import { getFirestoreErrorMessage } from '../../../utils/firestoreErrors';
import { parsePurchaseForm } from '../../../utils/purchase';

interface PurchaseSheetProps {
  visible: boolean;
  onClose: () => void;
  /** `buy`: marcar un deseo como comprado. `edit`: corregir los datos de un libro ya comprado. */
  mode: 'buy' | 'edit';
  /** Día de la compra («YYYY-MM-DD») con que arranca la hoja; hoy si el libro no tiene fecha. */
  initialDateKey: string;
  /** Precio con que arranca la hoja (texto), vacío si no hay. */
  initialPrice: string;
  todayKey: string;
  /** Guarda la compra. Si falla, la hoja muestra el error y sigue abierta. */
  onSave: (purchase: PurchaseFields) => Promise<void>;
}

/**
 * Hoja para registrar la compra de un libro: la fecha (hoy por defecto, cualquier día pasado en un calendario) y,
 * si se quiere, el precio. El calendario sustituye al formulario mientras se elige el día, en lugar de abrir otra hoja encima.
 */
export function PurchaseSheet({ visible, onClose, mode, initialDateKey, initialPrice, todayKey, onSave }: PurchaseSheetProps) {
  const [dateKey, setDateKey] = useState(initialDateKey);
  const [price, setPrice] = useState(initialPrice);
  const [choosingDate, setChoosingDate] = useState(false);
  const [month, setMonth] = useState<YearMonth>(() => monthOf(initialDateKey));
  const [errors, setErrors] = useState<{ date?: string; price?: string; save?: string }>({});
  const [saving, setSaving] = useState(false);

  // Cada vez que se abre arranca con los datos actuales y sin errores.
  useEffect(() => {
    if (visible) {
      setDateKey(initialDateKey);
      setPrice(initialPrice);
      setMonth(monthOf(initialDateKey));
      setChoosingDate(false);
      setErrors({});
    }
  }, [visible, initialDateKey, initialPrice]);

  const handleSave = async () => {
    if (saving) return;
    const result = parsePurchaseForm({ dateKey, price }, new Date(), todayKey);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await onSave(result.data);
      onClose();
    } catch (e) {
      setErrors({ save: getFirestoreErrorMessage(e) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose}>
      {choosingDate ? (
        <MonthCalendar
          month={month}
          onMonthChange={setMonth}
          todayKey={todayKey}
          selectedKey={dateKey}
          maxKey={todayKey}
          onSelect={(picked) => {
            setDateKey(picked);
            setMonth(monthOf(picked));
            setChoosingDate(false);
            setErrors((current) => ({ ...current, date: undefined }));
          }}
        />
      ) : (
        <View style={styles.content}>
          <PickerRow
            label="Fecha de compra"
            value={formatDayLabel(dateKey, todayKey)}
            icon="calendar-outline"
            error={errors.date}
            onPress={() => setChoosingDate(true)}
          />
          <TextField
            label="Precio (opcional)"
            placeholder="45000"
            value={price}
            onChangeText={(value) => {
              setPrice(value);
              setErrors((current) => ({ ...current, price: undefined }));
            }}
            error={errors.price ?? errors.save}
            keyboardType="decimal-pad"
            returnKeyType="done"
            onSubmitEditing={handleSave}
          />
          <Button title={mode === 'buy' ? 'Marcar como comprado' : 'Guardar'} onPress={handleSave} loading={saving} />
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
});
