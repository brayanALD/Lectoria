import dayjs from 'dayjs';
import 'dayjs/locale/es';

/** Cualquier valor con `toDate()`, como el `Timestamp` de Firestore (sin importar Firebase en una utilidad pura). */
export interface DateLike {
  toDate(): Date;
}

/** «13 de octubre de 2026», en la zona horaria del dispositivo. */
export function formatLongDate(value: Date | DateLike): string {
  const date = value instanceof Date ? value : value.toDate();
  return dayjs(date).locale('es').format('D [de] MMMM [de] YYYY');
}
