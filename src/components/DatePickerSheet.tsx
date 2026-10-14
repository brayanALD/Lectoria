import { useState } from 'react';

import { monthOf } from '../utils/calendar';
import { MonthCalendar } from './MonthCalendar';
import { Sheet } from './Sheet';

interface DatePickerSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Día elegido actualmente («YYYY-MM-DD»). */
  selectedKey: string;
  todayKey: string;
  /** Días con lectura, para que se vean al elegir fecha. */
  markedDays?: ReadonlySet<string>;
  onPick: (dateKey: string) => void;
}

/** Elegir un día en un calendario. No admite días futuros. Al elegir uno se cierra sola. */
export function DatePickerSheet({ visible, onClose, selectedKey, todayKey, markedDays, onPick }: DatePickerSheetProps) {
  // El mes visible arranca en el del día elegido cada vez que se abre la hoja.
  const [month, setMonth] = useState(() => monthOf(selectedKey));
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setMonth(monthOf(selectedKey));
  }

  return (
    <Sheet visible={visible} onClose={onClose}>
      <MonthCalendar
        month={month}
        onMonthChange={setMonth}
        todayKey={todayKey}
        selectedKey={selectedKey}
        markedDays={markedDays}
        maxKey={todayKey}
        onSelect={(dateKey) => {
          onPick(dateKey);
          onClose();
        }}
      />
    </Sheet>
  );
}
