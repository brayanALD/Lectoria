import { addDays, computeStreaks, dayNumber, getReadingDays, summarizeByDay } from './readingDays';

const session = (dateKey: string, durationMinutes: number, pagesRead: number) => ({ dateKey, durationMinutes, pagesRead });

describe('dayNumber / addDays', () => {
  it('días consecutivos difieren en 1, incluso al cambiar de mes y de año', () => {
    expect(dayNumber('2026-03-01') - dayNumber('2026-02-28')).toBe(1);
    expect(dayNumber('2026-01-01') - dayNumber('2025-12-31')).toBe(1);
  });

  it('febrero de un año bisiesto tiene 29 días', () => {
    expect(dayNumber('2028-03-01') - dayNumber('2028-02-28')).toBe(2);
    expect(dayNumber('2026-03-01') - dayNumber('2026-02-28')).toBe(1);
  });

  it('addDays avanza y retrocede días', () => {
    expect(addDays('2026-10-13', 1)).toBe('2026-10-14');
    expect(addDays('2026-10-01', -1)).toBe('2026-09-30');
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01');
    expect(addDays('2026-10-13', 0)).toBe('2026-10-13');
  });
});

describe('summarizeByDay', () => {
  it('suma minutos, páginas y sesiones de cada día', () => {
    const days = summarizeByDay([session('2026-10-12', 30, 20), session('2026-10-12', 10, 5), session('2026-10-13', 5, 0)]);
    expect(days.get('2026-10-12')).toEqual({ dateKey: '2026-10-12', minutes: 40, pages: 25, sessions: 2, isReadingDay: true });
    expect(days.get('2026-10-13')).toMatchObject({ minutes: 5, pages: 0, sessions: 1, isReadingDay: true });
  });

  it('un día sin sesiones no aparece', () => {
    expect(summarizeByDay([session('2026-10-12', 30, 0)]).has('2026-10-11')).toBe(false);
    expect(summarizeByDay([]).size).toBe(0);
  });
});

describe('día de lectura (más de 1 minuto o más de 1 página, en una misma sesión)', () => {
  it.each([
    [2, 0, true], // más de 1 minuto
    [0, 2, true], // más de 1 página
    [2, 2, true],
    [1, 1, false], // justo en el límite: no supera
    [1, 0, false],
    [0, 1, false],
  ])('%i minutos y %i páginas → cuenta: %s', (minutes, pages, expected) => {
    expect(getReadingDays([session('2026-10-13', minutes, pages)]).has('2026-10-13')).toBe(expected);
  });

  it('basta una sesión que supere el mínimo, aunque haya otras que no', () => {
    expect(getReadingDays([session('2026-10-13', 1, 1), session('2026-10-13', 10, 0)]).has('2026-10-13')).toBe(true);
  });

  it('el criterio se evalúa por sesión, no sumando el día', () => {
    // Dos sesiones de 1 minuto y 1 página suman 2 y 2, pero ninguna supera el mínimo por sí sola.
    expect(getReadingDays([session('2026-10-13', 1, 1), session('2026-10-13', 1, 1)]).has('2026-10-13')).toBe(false);
  });
});

describe('computeStreaks', () => {
  const today = '2026-10-13';

  it('sin días de lectura, las rachas son 0', () => {
    expect(computeStreaks([], today)).toEqual({ current: 0, longest: 0 });
  });

  it('cuenta los días consecutivos que terminan hoy', () => {
    expect(computeStreaks(['2026-10-11', '2026-10-12', '2026-10-13'], today)).toEqual({ current: 3, longest: 3 });
  });

  it('si hoy aún no se ha leído, mantiene la racha que terminaba ayer', () => {
    expect(computeStreaks(['2026-10-11', '2026-10-12'], today)).toEqual({ current: 2, longest: 2 });
  });

  it('pierde la racha actual si no se leyó ni hoy ni ayer, pero conserva el récord', () => {
    expect(computeStreaks(['2026-10-08', '2026-10-09', '2026-10-10'], today)).toEqual({ current: 0, longest: 3 });
  });

  it('un hueco de un día corta la racha', () => {
    expect(computeStreaks(['2026-10-10', '2026-10-12', '2026-10-13'], today)).toEqual({ current: 2, longest: 2 });
  });

  it('el récord puede estar en el pasado y ser mayor que la racha actual', () => {
    const past = ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05'];
    expect(computeStreaks([...past, '2026-10-13'], today)).toEqual({ current: 1, longest: 5 });
  });

  it('cruza el cambio de mes y de año sin cortarse', () => {
    expect(computeStreaks(['2025-12-30', '2025-12-31', '2026-01-01', '2026-01-02'], '2026-01-02')).toEqual({
      current: 4,
      longest: 4,
    });
  });

  it('ignora los días repetidos y el orden de entrada', () => {
    expect(computeStreaks(['2026-10-13', '2026-10-12', '2026-10-13', '2026-10-12'], today)).toEqual({ current: 2, longest: 2 });
  });

  it('los días posteriores a hoy no cuentan para la racha actual', () => {
    expect(computeStreaks(['2026-10-14', '2026-10-15'], today)).toEqual({ current: 0, longest: 2 });
  });

  it('un solo día de lectura hoy es una racha de 1', () => {
    expect(computeStreaks(['2026-10-13'], today)).toEqual({ current: 1, longest: 1 });
  });

  it('acepta cualquier iterable (un Set)', () => {
    expect(computeStreaks(new Set(['2026-10-12', '2026-10-13']), today).current).toBe(2);
  });
});
