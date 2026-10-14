import type { DailyGoal } from '../types/goal';
import type { SessionFormValues } from '../types/session';
import { summarizeByDay } from './readingDays';
import { parseSessionForm } from './session';
import { busiestDay, chartMetric, countFinishedBooks, describeMonthChart, summarizeDay, summarizeMonth } from './statistics';

interface TestSession {
  dateKey: string;
  durationMinutes: number;
  pagesRead: number;
}

const session = (dateKey: string, durationMinutes: number, pagesRead = 0): TestSession => ({ dateKey, durationMinutes, pagesRead });
const daysOf = (sessions: TestSession[]) => summarizeByDay(sessions);
const minutes = (target: number): DailyGoal => ({ type: 'minutes', target });
const pages = (target: number): DailyGoal => ({ type: 'pages', target });

const OCTOBER = { year: 2026, month: 10 };
const TODAY = '2026-10-13';

describe('chartMetric', () => {
  it('mide la unidad de la meta y, sin meta, los minutos', () => {
    expect(chartMetric(minutes(30))).toBe('minutes');
    expect(chartMetric(pages(20))).toBe('pages');
    expect(chartMetric(undefined)).toBe('minutes');
  });
});

describe('summarizeDay', () => {
  const days = daysOf([session('2026-10-12', 30, 20), session('2026-10-12', 10, 5), session('2026-10-13', 1, 1)]);

  it('suma lo leído en el día y cuenta sus sesiones', () => {
    expect(summarizeDay(days, '2026-10-12')).toEqual({
      dateKey: '2026-10-12',
      minutes: 40,
      pages: 25,
      sessions: 2,
      isReadingDay: true,
    });
  });

  it('un día sin actividad es todo ceros, sin meta ni día de lectura', () => {
    expect(summarizeDay(days, '2026-10-01')).toEqual({
      dateKey: '2026-10-01',
      minutes: 0,
      pages: 0,
      sessions: 0,
      isReadingDay: false,
    });
  });

  it('una sesión de 1 minuto y 1 página se registra pero no hace día de lectura', () => {
    expect(summarizeDay(days, '2026-10-13')).toMatchObject({ minutes: 1, pages: 1, sessions: 1, isReadingDay: false });
  });

  it('con meta de minutos añade el cumplimiento medido en minutos', () => {
    expect(summarizeDay(days, '2026-10-12', minutes(60)).progress).toMatchObject({ type: 'minutes', value: 40, percent: 66, met: false });
    expect(summarizeDay(days, '2026-10-12', minutes(40)).progress).toMatchObject({ value: 40, percent: 100, met: true });
  });

  it('con meta de páginas añade el cumplimiento medido en páginas', () => {
    expect(summarizeDay(days, '2026-10-12', pages(20)).progress).toMatchObject({ type: 'pages', value: 25, met: true });
    expect(summarizeDay(days, '2026-10-12', pages(50)).progress).toMatchObject({ value: 25, percent: 50, met: false });
  });

  it('un día sin actividad con meta tiene 0 % y falta toda la meta', () => {
    expect(summarizeDay(days, '2026-10-01', minutes(30)).progress).toMatchObject({ value: 0, percent: 0, remaining: 30, met: false });
  });

  it('sin meta no hay cumplimiento', () => {
    expect(summarizeDay(days, '2026-10-12')).not.toHaveProperty('progress');
  });
});

describe('summarizeMonth: totales y días del mes', () => {
  const days = daysOf([
    session('2026-10-01', 30, 20),
    session('2026-10-01', 15, 0),
    session('2026-10-13', 0, 12),
    session('2026-10-31', 45, 30),
    session('2026-09-30', 99, 99), // el mes anterior no se mezcla
    session('2026-11-01', 88, 88), // ni el siguiente
  ]);

  it('suma tiempo, páginas, sesiones y días de lectura solo del mes pedido', () => {
    const stats = summarizeMonth(days, OCTOBER, '2026-10-31');
    expect(stats.totals).toEqual({ readingDays: 3, minutes: 90, pages: 62, sessions: 4 });
  });

  it('el último día del mes y el primero del siguiente caen en su mes', () => {
    expect(summarizeMonth(days, OCTOBER, '2026-11-30').totals.minutes).toBe(90);
    expect(summarizeMonth(days, { year: 2026, month: 11 }, '2026-11-30').totals).toMatchObject({ minutes: 88, pages: 88 });
    expect(summarizeMonth(days, { year: 2026, month: 9 }, '2026-11-30').totals).toMatchObject({ minutes: 99, pages: 99 });
  });

  it.each([
    [{ year: 2026, month: 2 }, 28],
    [{ year: 2028, month: 2 }, 29], // bisiesto
    [{ year: 2100, month: 2 }, 28], // el año 2100 no es bisiesto
    [{ year: 2026, month: 4 }, 30],
    [{ year: 2026, month: 10 }, 31],
  ])('%j tiene %i puntos, uno por día y en orden', (month, expected) => {
    const stats = summarizeMonth(new Map(), month, '2999-12-31');
    expect(stats.daysInMonth).toBe(expected);
    expect(stats.points).toHaveLength(expected);
    expect(stats.points[0].dateKey).toMatch(/-01$/);
    expect(stats.points[expected - 1].dateKey).toMatch(new RegExp(`-${expected}$`));
  });

  it('el cambio de año: diciembre y enero se separan por año', () => {
    const yearDays = daysOf([session('2026-12-31', 10), session('2027-01-01', 20)]);
    expect(summarizeMonth(yearDays, { year: 2026, month: 12 }, '2027-01-15').totals.minutes).toBe(10);
    expect(summarizeMonth(yearDays, { year: 2027, month: 1 }, '2027-01-15').totals.minutes).toBe(20);
  });

  it('un mes sin actividad es todo ceros y no falla', () => {
    const stats = summarizeMonth(new Map(), OCTOBER, TODAY);
    expect(stats.totals).toEqual({ readingDays: 0, minutes: 0, pages: 0, sessions: 0 });
    expect(stats.maxValue).toBe(0);
    expect(stats.points.every((point) => point.value === 0)).toBe(true);
  });

  it('cada punto lleva los minutos y las páginas de su día', () => {
    const stats = summarizeMonth(days, OCTOBER, '2026-10-31');
    expect(stats.points[0]).toMatchObject({ dateKey: '2026-10-01', minutes: 45, pages: 20 });
    expect(stats.points[12]).toMatchObject({ dateKey: '2026-10-13', minutes: 0, pages: 12 });
  });
});

describe('summarizeMonth: días transcurridos, pasados y futuros', () => {
  it('en el mes actual solo han transcurrido los días hasta hoy, y hoy cuenta', () => {
    const stats = summarizeMonth(new Map(), OCTOBER, '2026-10-13');
    expect(stats.elapsedDays).toBe(13);
    expect(stats.points.filter((point) => point.future)).toHaveLength(18);
    expect(stats.points[12].future).toBe(false); // hoy
    expect(stats.points[13].future).toBe(true); // mañana
  });

  it('el primer y el último día del mes como «hoy»', () => {
    expect(summarizeMonth(new Map(), OCTOBER, '2026-10-01').elapsedDays).toBe(1);
    expect(summarizeMonth(new Map(), OCTOBER, '2026-10-31').elapsedDays).toBe(31);
  });

  it('un mes pasado ha transcurrido entero', () => {
    const stats = summarizeMonth(new Map(), { year: 2026, month: 9 }, TODAY);
    expect(stats.elapsedDays).toBe(30);
    expect(stats.points.some((point) => point.future)).toBe(false);
  });

  it('un mes futuro no ha transcurrido: todos sus días son futuros', () => {
    const stats = summarizeMonth(new Map(), { year: 2026, month: 11 }, TODAY);
    expect(stats.elapsedDays).toBe(0);
    expect(stats.points.every((point) => point.future)).toBe(true);
  });

  it('un mes futuro con meta no incumple nada y su porcentaje es 0, no NaN', () => {
    const stats = summarizeMonth(new Map(), { year: 2026, month: 11 }, TODAY, minutes(30));
    expect(stats.goal).toEqual({ daysMet: 0, percent: 0 });
    expect(stats.points.every((point) => point.goalMet === undefined)).toBe(true);
  });

  it('cambiar el «hoy» (cambio de día) cambia qué días han transcurrido, con los mismos datos', () => {
    const days = daysOf([session('2026-10-13', 30)]);
    const before = summarizeMonth(days, OCTOBER, '2026-10-13', minutes(30));
    const after = summarizeMonth(days, OCTOBER, '2026-10-14', minutes(30));
    expect(before.elapsedDays).toBe(13);
    expect(after.elapsedDays).toBe(14);
    expect(before.goal).toEqual({ daysMet: 1, percent: 7 }); // 1 de 13
    expect(after.goal).toEqual({ daysMet: 1, percent: 7 }); // 1 de 14
  });

  it('una sesión con fecha futura (p. ej. tras cambiar de zona horaria) se cuenta en los totales pero no se evalúa contra la meta', () => {
    const days = daysOf([session('2026-10-20', 50, 10)]);
    const stats = summarizeMonth(days, OCTOBER, TODAY, minutes(30));
    expect(stats.totals).toMatchObject({ minutes: 50, readingDays: 1 });
    const future = stats.points.find((point) => point.dateKey === '2026-10-20');
    expect(future).toMatchObject({ future: true, value: 50 });
    expect(future?.goalMet).toBeUndefined();
    expect(stats.goal?.daysMet).toBe(0);
  });
});

describe('summarizeMonth: meta diaria', () => {
  const days = daysOf([
    session('2026-10-01', 30, 5), // cumple justo 30 min
    session('2026-10-02', 29, 50), // 1 min menos: no cumple 30 min, pero sí 30 páginas
    session('2026-10-03', 120, 0), // muy por encima
    session('2026-10-05', 10, 0),
  ]);

  it('meta de minutos: cuenta los días en que se alcanzó, solo entre los transcurridos', () => {
    const stats = summarizeMonth(days, OCTOBER, '2026-10-05', minutes(30));
    expect(stats.goal).toEqual({ daysMet: 2, percent: 40 }); // 1.º y 3.º de 5 días
    expect(stats.points.map((point) => point.goalMet).slice(0, 5)).toEqual([true, false, true, false, false]);
  });

  it('meta de páginas: el mismo mes se mide en páginas', () => {
    const stats = summarizeMonth(days, OCTOBER, '2026-10-05', pages(30));
    expect(stats.goal).toEqual({ daysMet: 1, percent: 20 }); // solo el 2.º tiene ≥ 30 páginas
    expect(stats.points[1]).toMatchObject({ goalMet: true, value: 50 });
  });

  it('el gráfico mide minutos con meta de minutos y páginas con meta de páginas', () => {
    expect(summarizeMonth(days, OCTOBER, '2026-10-05', minutes(30)).points[2].value).toBe(120);
    expect(summarizeMonth(days, OCTOBER, '2026-10-05', pages(30)).points[2].value).toBe(0);
    expect(summarizeMonth(days, OCTOBER, '2026-10-05', pages(30)).maxValue).toBe(50);
    expect(summarizeMonth(days, OCTOBER, '2026-10-05', minutes(30)).maxValue).toBe(120);
  });

  it('sin meta mide minutos y no hay cumplimiento', () => {
    const stats = summarizeMonth(days, OCTOBER, '2026-10-05');
    expect(stats).not.toHaveProperty('goal');
    expect(stats.points[2].value).toBe(120);
    expect(stats.points.every((point) => point.goalMet === undefined)).toBe(true);
  });

  it('todos los días cumplidos es 100 %; ninguno, 0 %', () => {
    const everyDay = daysOf(Array.from({ length: 5 }, (_, i) => session(`2026-10-0${i + 1}`, 40)));
    expect(summarizeMonth(everyDay, OCTOBER, '2026-10-05', minutes(30)).goal).toEqual({ daysMet: 5, percent: 100 });
    expect(summarizeMonth(new Map(), OCTOBER, '2026-10-05', minutes(30)).goal).toEqual({ daysMet: 0, percent: 0 });
  });

  it('el porcentaje no redondea hacia arriba: 29 de 30 días no es 100 %', () => {
    const almost = daysOf(Array.from({ length: 29 }, (_, i) => session(`2026-09-${String(i + 1).padStart(2, '0')}`, 40)));
    expect(summarizeMonth(almost, { year: 2026, month: 9 }, TODAY, minutes(30)).goal).toEqual({ daysMet: 29, percent: 96 });
  });

  it('un día solo con minutos no cumple una meta de páginas y al revés', () => {
    const mixed = daysOf([session('2026-10-01', 90, 0), session('2026-10-02', 0, 40)]);
    expect(summarizeMonth(mixed, OCTOBER, '2026-10-02', pages(30)).points.map((p) => p.goalMet).slice(0, 2)).toEqual([false, true]);
    expect(summarizeMonth(mixed, OCTOBER, '2026-10-02', minutes(30)).points.map((p) => p.goalMet).slice(0, 2)).toEqual([true, false]);
  });
});

describe('las estadísticas se recalculan solas al crear, editar y eliminar sesiones', () => {
  const base = [session('2026-10-05', 30, 10), session('2026-10-06', 20, 5)];
  const month = (sessions: TestSession[], goal?: DailyGoal) => summarizeMonth(daysOf(sessions), OCTOBER, TODAY, goal);

  it('crear una sesión suma a los totales, a los días de lectura y a la meta', () => {
    const before = month(base, minutes(30));
    const after = month([...base, session('2026-10-07', 45, 20)], minutes(30));
    expect(after.totals.minutes).toBe(before.totals.minutes + 45);
    expect(after.totals.readingDays).toBe(before.totals.readingDays + 1);
    expect(after.goal?.daysMet).toBe((before.goal?.daysMet ?? 0) + 1);
  });

  it('editar los minutos de una sesión cambia el total y puede cambiar si se cumplió la meta', () => {
    expect(month(base, minutes(30)).goal?.daysMet).toBe(1);
    const edited = base.map((s) => (s.dateKey === '2026-10-06' ? { ...s, durationMinutes: 35 } : s));
    expect(month(edited, minutes(30)).totals.minutes).toBe(65);
    expect(month(edited, minutes(30)).goal?.daysMet).toBe(2);
  });

  it('mover una sesión de mes la quita de uno y la suma al otro, sin contarla dos veces', () => {
    const moved = base.map((s) => (s.dateKey === '2026-10-06' ? { ...s, dateKey: '2026-09-28' } : s));
    expect(month(moved).totals).toMatchObject({ minutes: 30, readingDays: 1, sessions: 1 });
    expect(summarizeMonth(daysOf(moved), { year: 2026, month: 9 }, TODAY).totals).toMatchObject({ minutes: 20, sessions: 1 });
  });

  it('eliminar una sesión la quita de todo, y eliminar la última deja el mes en ceros', () => {
    expect(month(base.slice(0, 1)).totals).toMatchObject({ minutes: 30, sessions: 1 });
    const none = month([]);
    expect(none.totals).toEqual({ readingDays: 0, minutes: 0, pages: 0, sessions: 0 });
    expect(none.maxValue).toBe(0);
  });

  it('editar solo las páginas de una sesión cambia una meta de páginas y no una de minutos', () => {
    const edited = base.map((s) => (s.dateKey === '2026-10-05' ? { ...s, pagesRead: 40 } : s));
    expect(month(edited, pages(30)).goal?.daysMet).toBe(1);
    expect(month(base, pages(30)).goal?.daysMet).toBe(0);
    expect(month(edited, minutes(30)).goal?.daysMet).toBe(month(base, minutes(30)).goal?.daysMet);
  });
});

describe('zonas horarias: el día de una sesión decide su mes', () => {
  const form = (date: Date, minutesText = '30'): SessionFormValues => ({ date, minutes: minutesText, startPage: '', endPage: '', notes: '' });
  const dateKeyIn = (instant: string, timeZone: string) => {
    const result = parseSessionForm(form(new Date(instant)), 'libro', { currentPage: 0 }, new Date('2030-01-01T00:00:00Z'), timeZone);
    if (!result.ok) throw new Error('sesión inválida');
    return result.data.dateKey;
  };

  // 2026-11-01T03:00Z es todavía el 31 de octubre en Bogotá (UTC−5) y ya el 1 de noviembre en Tokio (UTC+9).
  const instant = '2026-11-01T03:00:00Z';

  it('la misma lectura cuenta en octubre en Bogotá y en noviembre en Tokio', () => {
    expect(dateKeyIn(instant, 'America/Bogota')).toBe('2026-10-31');
    expect(dateKeyIn(instant, 'Asia/Tokyo')).toBe('2026-11-01');

    const bogota = daysOf([{ dateKey: dateKeyIn(instant, 'America/Bogota'), durationMinutes: 30, pagesRead: 0 }]);
    const tokyo = daysOf([{ dateKey: dateKeyIn(instant, 'Asia/Tokyo'), durationMinutes: 30, pagesRead: 0 }]);
    const november = { year: 2026, month: 11 };
    expect(summarizeMonth(bogota, OCTOBER, '2026-11-15').totals.minutes).toBe(30);
    expect(summarizeMonth(bogota, november, '2026-11-15').totals.minutes).toBe(0);
    expect(summarizeMonth(tokyo, OCTOBER, '2026-11-15').totals.minutes).toBe(0);
    expect(summarizeMonth(tokyo, november, '2026-11-15').totals.minutes).toBe(30);
  });

  it('en el cambio de año, la zona decide el año del mes', () => {
    expect(dateKeyIn('2027-01-01T02:00:00Z', 'America/Bogota')).toBe('2026-12-31');
    expect(dateKeyIn('2027-01-01T02:00:00Z', 'Pacific/Kiritimati')).toBe('2027-01-01');
  });

  it('una sesión justo antes y justo después de la medianoche local cae en días distintos', () => {
    expect(dateKeyIn('2026-10-13T04:59:59Z', 'America/Bogota')).toBe('2026-10-12');
    expect(dateKeyIn('2026-10-13T05:00:00Z', 'America/Bogota')).toBe('2026-10-13');
  });

  it('un libro terminado se cuenta en el mes de su zona horaria', () => {
    const finished = [{ status: 'finished' as const, finishedAt: { toDate: () => new Date(instant) } }];
    expect(countFinishedBooks(finished, OCTOBER, 'America/Bogota')).toBe(1);
    expect(countFinishedBooks(finished, { year: 2026, month: 11 }, 'America/Bogota')).toBe(0);
    expect(countFinishedBooks(finished, OCTOBER, 'Asia/Tokyo')).toBe(0);
    expect(countFinishedBooks(finished, { year: 2026, month: 11 }, 'Asia/Tokyo')).toBe(1);
  });
});

describe('countFinishedBooks', () => {
  const at = (iso: string) => ({ toDate: () => new Date(iso) });
  const books = [
    { status: 'finished' as const, finishedAt: at('2026-10-05T12:00:00Z') },
    { status: 'finished' as const, finishedAt: at('2026-10-20T12:00:00Z') },
    { status: 'finished' as const, finishedAt: at('2026-09-30T12:00:00Z') },
    { status: 'reading' as const, finishedAt: at('2026-10-10T12:00:00Z') }, // se reabrió: ya no cuenta
    { status: 'finished' as const }, // terminado sin fecha de fin
    { status: 'reading' as const },
  ];

  it('cuenta los terminados cuya fecha de fin cae en el mes', () => {
    expect(countFinishedBooks(books, OCTOBER, 'UTC')).toBe(2);
    expect(countFinishedBooks(books, { year: 2026, month: 9 }, 'UTC')).toBe(1);
  });

  it('un mes sin libros terminados es 0, y también una biblioteca vacía', () => {
    expect(countFinishedBooks(books, { year: 2026, month: 8 }, 'UTC')).toBe(0);
    expect(countFinishedBooks([], OCTOBER, 'UTC')).toBe(0);
  });

  it('los límites del mes: el último segundo de octubre y el primero de noviembre', () => {
    const edge = [
      { status: 'finished' as const, finishedAt: at('2026-10-31T23:59:59Z') },
      { status: 'finished' as const, finishedAt: at('2026-11-01T00:00:00Z') },
    ];
    expect(countFinishedBooks(edge, OCTOBER, 'UTC')).toBe(1);
    expect(countFinishedBooks(edge, { year: 2026, month: 11 }, 'UTC')).toBe(1);
  });
});

describe('busiestDay / describeMonthChart', () => {
  const days = daysOf([session('2026-10-02', 20), session('2026-10-09', 45), session('2026-10-20', 45)]);
  const stats = summarizeMonth(days, OCTOBER, '2026-10-31');

  it('el día con más lectura es el primero si hay empate', () => {
    expect(busiestDay(stats.points)?.dateKey).toBe('2026-10-09');
  });

  it('sin lectura no hay día destacado', () => {
    expect(busiestDay(summarizeMonth(new Map(), OCTOBER, TODAY).points)).toBeUndefined();
  });

  it('describe el gráfico en minutos con su día más largo', () => {
    expect(describeMonthChart(stats, 'minutes')).toBe('Minutos por día. 3 días de lectura. Más lectura: día 9, 45 min.');
  });

  it('describe el gráfico en páginas y en singular', () => {
    const one = summarizeMonth(daysOf([session('2026-10-04', 0, 12)]), OCTOBER, '2026-10-31', pages(10));
    expect(describeMonthChart(one, 'pages')).toBe('Páginas por día. 1 día de lectura. Más lectura: día 4, 12 págs.');
  });

  it('un mes sin lectura se describe sin día destacado', () => {
    expect(describeMonthChart(summarizeMonth(new Map(), OCTOBER, TODAY), 'minutes')).toBe('Minutos por día. 0 días de lectura.');
  });
});
