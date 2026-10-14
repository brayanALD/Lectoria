import { summarizeByDay } from './readingDays';
import { formatDuration, formatTotals, summarizeYear, totalsForDays } from './readingStats';

const session = (dateKey: string, durationMinutes: number, pagesRead: number) => ({ dateKey, durationMinutes, pagesRead });

const days = summarizeByDay([
  session('2026-10-12', 30, 20),
  session('2026-10-12', 10, 5),
  session('2026-10-13', 1, 1), // se guarda, pero no supera el mínimo: no es día de lectura
  session('2026-09-30', 45, 0),
  session('2025-12-31', 20, 10),
]);

describe('totalsForDays', () => {
  it('suma minutos, páginas y sesiones de los días indicados', () => {
    expect(totalsForDays(days, ['2026-10-12', '2026-10-13'])).toEqual({ readingDays: 1, minutes: 41, pages: 26, sessions: 3 });
  });

  it('ignora los días sin sesiones y los que no se piden', () => {
    expect(totalsForDays(days, ['2026-10-11', '2026-10-14'])).toEqual({ readingDays: 0, minutes: 0, pages: 0, sessions: 0 });
    expect(totalsForDays(days, ['2026-09-30'])).toMatchObject({ readingDays: 1, minutes: 45 });
  });

  it('con una lista vacía, todo en cero', () => {
    expect(totalsForDays(days, [])).toEqual({ readingDays: 0, minutes: 0, pages: 0, sessions: 0 });
  });
});

describe('summarizeYear', () => {
  const { months, total } = summarizeYear(days, 2026);

  it('devuelve siempre los doce meses con sus días', () => {
    expect(months.map((m) => m.month)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(months[1].daysInMonth).toBe(28);
    expect(summarizeYear(days, 2028).months[1].daysInMonth).toBe(29);
    expect(months[9].daysInMonth).toBe(31);
  });

  it('reparte las sesiones en su mes y deja vacíos los demás', () => {
    expect(months[9]).toMatchObject({ month: 10, readingDays: 1, minutes: 41, pages: 26, sessions: 3 });
    expect(months[8]).toMatchObject({ month: 9, readingDays: 1, minutes: 45 });
    expect(months[0]).toMatchObject({ readingDays: 0, minutes: 0, pages: 0, sessions: 0 });
  });

  it('el total del año suma solo ese año (no cuenta diciembre de 2025)', () => {
    expect(total).toEqual({ readingDays: 2, minutes: 86, pages: 26, sessions: 4 });
    expect(summarizeYear(days, 2025).total).toMatchObject({ minutes: 20, pages: 10, readingDays: 1 });
  });

  it('un año sin lecturas está vacío', () => {
    expect(summarizeYear(days, 2020).total).toEqual({ readingDays: 0, minutes: 0, pages: 0, sessions: 0 });
  });

  it('no modifica los resúmenes de entrada', () => {
    const before = JSON.stringify([...days.entries()]);
    summarizeYear(days, 2026);
    expect(JSON.stringify([...days.entries()])).toBe(before);
  });
});

describe('formatDuration', () => {
  it.each([
    [0, '0 min'],
    [45, '45 min'],
    [59, '59 min'],
    [60, '1 h'],
    [125, '2 h 05 min'],
    [190, '3 h 10 min'],
    [1440, '24 h'],
  ])('%i minutos → %s', (minutes, expected) => {
    expect(formatDuration(minutes)).toBe(expected);
  });
});

describe('formatTotals', () => {
  it('combina minutos y páginas', () => {
    expect(formatTotals({ minutes: 125, pages: 40 })).toBe('2 h 05 min · 40 págs');
  });

  it('omite la parte que es cero y usa el singular para una página', () => {
    expect(formatTotals({ minutes: 30, pages: 0 })).toBe('30 min');
    expect(formatTotals({ minutes: 0, pages: 1 })).toBe('1 pág');
    expect(formatTotals({ minutes: 0, pages: 20 })).toBe('20 págs');
  });

  it('sin nada, «Sin lectura»', () => {
    expect(formatTotals({ minutes: 0, pages: 0 })).toBe('Sin lectura');
  });
});
