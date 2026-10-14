import {
  WEEKDAY_LABELS,
  addMonths,
  compareMonths,
  dateForDay,
  firstDayOfMonth,
  formatMonthShort,
  formatWeekLabel,
  formatWeekdayAndDay,
  getWeekDays,
  startOfWeek,
  formatDayLabel,
  formatMonthLabel,
  getMonthGrid,
  monthOf,
  toDayKey,
} from './calendar';
import { toDateKey } from './session';

describe('toDayKey / monthOf', () => {
  it('rellena con ceros y es la inversa de monthOf', () => {
    expect(toDayKey(2026, 3, 5)).toBe('2026-03-05');
    expect(monthOf('2026-03-05')).toEqual({ year: 2026, month: 3 });
  });
});

describe('addMonths', () => {
  it('avanza y retrocede dentro del año', () => {
    expect(addMonths({ year: 2026, month: 5 }, 1)).toEqual({ year: 2026, month: 6 });
    expect(addMonths({ year: 2026, month: 5 }, -1)).toEqual({ year: 2026, month: 4 });
  });

  it('cruza el cambio de año en ambos sentidos', () => {
    expect(addMonths({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(addMonths({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
  });

  it('admite saltos de más de un año', () => {
    expect(addMonths({ year: 2026, month: 10 }, 15)).toEqual({ year: 2028, month: 1 });
    expect(addMonths({ year: 2026, month: 10 }, -10)).toEqual({ year: 2025, month: 12 });
    expect(addMonths({ year: 2026, month: 10 }, 0)).toEqual({ year: 2026, month: 10 });
  });
});

describe('compareMonths', () => {
  it('ordena por año y mes', () => {
    expect(compareMonths({ year: 2026, month: 10 }, { year: 2026, month: 10 })).toBe(0);
    expect(compareMonths({ year: 2026, month: 9 }, { year: 2026, month: 10 })).toBeLessThan(0);
    expect(compareMonths({ year: 2027, month: 1 }, { year: 2026, month: 12 })).toBeGreaterThan(0);
  });
});

describe('formatMonthLabel', () => {
  it('escribe el mes en español', () => {
    expect(formatMonthLabel({ year: 2026, month: 10 })).toBe('octubre de 2026');
    expect(formatMonthLabel({ year: 2026, month: 1 })).toBe('enero de 2026');
  });
});

describe('getMonthGrid', () => {
  it('todas las filas tienen 7 celdas', () => {
    for (const month of [1, 2, 3, 6, 10, 12]) {
      for (const row of getMonthGrid({ year: 2026, month })) expect(row).toHaveLength(7);
    }
  });

  it('octubre de 2026 empieza en jueves (lunes primero) y termina en sábado 31', () => {
    const grid = getMonthGrid({ year: 2026, month: 10 });
    expect(grid[0]).toEqual([null, null, null, '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
    expect(grid[grid.length - 1]).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', null]);
    expect(grid).toHaveLength(5);
  });

  it('contiene todos los días del mes, una sola vez y en orden', () => {
    const days = getMonthGrid({ year: 2026, month: 10 }).flat().filter((cell): cell is string => cell !== null);
    expect(days).toHaveLength(31);
    expect(days[0]).toBe('2026-10-01');
    expect(days[30]).toBe('2026-10-31');
    expect([...days].sort()).toEqual(days);
  });

  it('un mes que empieza en lunes no deja huecos al principio (junio de 2026)', () => {
    expect(getMonthGrid({ year: 2026, month: 6 })[0][0]).toBe('2026-06-01');
  });

  it('un mes que empieza en domingo deja seis huecos (febrero de 2026)', () => {
    const first = getMonthGrid({ year: 2026, month: 2 })[0];
    expect(first.slice(0, 6)).toEqual([null, null, null, null, null, null]);
    expect(first[6]).toBe('2026-02-01');
  });

  it('febrero tiene 28 o 29 días según el año (bisiesto)', () => {
    const count = (year: number) => getMonthGrid({ year, month: 2 }).flat().filter(Boolean).length;
    expect(count(2026)).toBe(28);
    expect(count(2028)).toBe(29);
  });

  it('un mes puede necesitar seis semanas (agosto de 2026 empieza en sábado)', () => {
    expect(getMonthGrid({ year: 2026, month: 8 })).toHaveLength(6);
  });

  it('hay una inicial de día por columna', () => {
    expect(WEEKDAY_LABELS).toHaveLength(7);
  });
});

describe('dateForDay', () => {
  const now = new Date(2026, 9, 13, 18, 45, 0);

  it('hoy conserva la hora actual', () => {
    expect(dateForDay('2026-10-13', now, '2026-10-13')).toBe(now);
  });

  it('un día pasado se fija al mediodía local', () => {
    const date = dateForDay('2026-10-05', now, '2026-10-13');
    expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes()]).toEqual([2026, 9, 5, 12, 0]);
  });

  it('el instante de un día pasado vuelve al mismo día al calcular su dateKey', () => {
    for (const day of ['2026-10-05', '2026-01-01', '2025-12-31', '2026-03-29']) {
      expect(toDateKey(dateForDay(day, now, '2026-10-13'))).toBe(day);
    }
  });
});

describe('formatDayLabel', () => {
  it('distingue hoy, ayer y otras fechas', () => {
    expect(formatDayLabel('2026-10-13', '2026-10-13')).toBe('Hoy');
    expect(formatDayLabel('2026-10-12', '2026-10-13')).toBe('Ayer');
    expect(formatDayLabel('2026-10-05', '2026-10-13')).toBe('5 de octubre de 2026');
  });

  it('ayer cruza el cambio de mes y de año', () => {
    expect(formatDayLabel('2026-09-30', '2026-10-01')).toBe('Ayer');
    expect(formatDayLabel('2025-12-31', '2026-01-01')).toBe('Ayer');
  });
});

describe('startOfWeek / getWeekDays', () => {
  it('el lunes de cualquier día de la semana es el mismo lunes', () => {
    // 12 de octubre de 2026 es lunes.
    for (const day of ['2026-10-12', '2026-10-13', '2026-10-15', '2026-10-18']) expect(startOfWeek(day)).toBe('2026-10-12');
  });

  it('el domingo pertenece a la semana que termina en él, no a la siguiente', () => {
    expect(startOfWeek('2026-10-18')).toBe('2026-10-12');
    expect(startOfWeek('2026-10-19')).toBe('2026-10-19');
  });

  it('cruza el cambio de mes y de año', () => {
    expect(startOfWeek('2026-10-01')).toBe('2026-09-28');
    expect(startOfWeek('2026-01-01')).toBe('2025-12-29');
  });

  it('la semana tiene siete días consecutivos de lunes a domingo', () => {
    expect(getWeekDays('2026-10-15')).toEqual([
      '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18',
    ]);
    expect(getWeekDays('2025-12-31')[0]).toBe('2025-12-29');
    expect(getWeekDays('2025-12-31')[6]).toBe('2026-01-04');
  });
});

describe('formatWeekLabel', () => {
  it('una semana dentro de un mes', () => {
    expect(formatWeekLabel('2026-10-14')).toBe('12 – 18 de octubre de 2026');
  });

  it('una semana que cruza de mes', () => {
    expect(formatWeekLabel('2026-10-01')).toBe('28 de septiembre – 4 de octubre de 2026');
  });

  it('una semana que cruza de año indica los dos años', () => {
    expect(formatWeekLabel('2026-01-01')).toBe('29 de diciembre de 2025 – 4 de enero de 2026');
  });
});

describe('firstDayOfMonth', () => {
  it('devuelve el día 1 del mes', () => {
    expect(firstDayOfMonth('2026-10-27')).toBe('2026-10-01');
    expect(firstDayOfMonth('2026-02-01')).toBe('2026-02-01');
  });
});

describe('formatWeekdayAndDay / formatMonthShort', () => {
  it('abrevia el día de la semana en español', () => {
    expect(formatWeekdayAndDay('2026-10-12')).toBe('lun 12');
    expect(formatWeekdayAndDay('2026-10-18')).toBe('dom 18');
    expect(formatWeekdayAndDay('2026-10-01')).toBe('jue 1');
  });

  it('abrevia los doce meses sin punto', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(formatMonthShort)).toEqual([
      'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
    ]);
  });
});
