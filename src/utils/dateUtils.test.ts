import { formatLongDate } from './dateUtils';

describe('formatLongDate', () => {
  it('formatea una fecha en español', () => {
    expect(formatLongDate(new Date(2026, 9, 13))).toBe('13 de octubre de 2026');
    expect(formatLongDate(new Date(2025, 0, 1))).toBe('1 de enero de 2025');
  });

  it('acepta un valor con toDate(), como el Timestamp de Firestore', () => {
    expect(formatLongDate({ toDate: () => new Date(2026, 11, 31) })).toBe('31 de diciembre de 2026');
  });

  it('no altera otras instancias de dayjs (el idioma se aplica solo a esta llamada)', () => {
    formatLongDate(new Date(2026, 9, 13));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    expect(require('dayjs')(new Date(2026, 9, 13)).format('MMMM')).toBe('October');
  });
});
