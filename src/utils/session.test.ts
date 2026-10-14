import type { SessionBookContext, SessionFormValues } from '../types/session';
import {
  MAX_SESSION_MINUTES,
  MAX_SESSION_NOTES,
  isReadingSession,
  parseSessionForm,
  planSessionBookUpdate,
  toDateKey,
} from './session';

const NOW = new Date('2026-10-13T15:00:00Z');
const book = { currentPage: 100, pageCount: 300 };

const form = (overrides: Partial<SessionFormValues> = {}): SessionFormValues => ({
  date: NOW,
  minutes: '',
  startPage: '',
  endPage: '',
  notes: '',
  ...overrides,
});

const parse = (overrides: Partial<SessionFormValues> = {}, ctx: SessionBookContext = book) =>
  parseSessionForm(form(overrides), 'book1', ctx, NOW, 'UTC');

describe('isReadingSession', () => {
  it.each([
    [2, 0, true],
    [0, 2, true],
    [1, 1, false],
    [0, 0, false],
  ])('%i min y %i páginas → %s', (durationMinutes, pagesRead, expected) => {
    expect(isReadingSession({ durationMinutes, pagesRead })).toBe(expected);
  });
});

describe('toDateKey', () => {
  const instant = new Date('2026-10-13T02:30:00Z');

  it('devuelve el día en la zona horaria indicada, que puede diferir del día UTC', () => {
    expect(toDateKey(instant, 'UTC')).toBe('2026-10-13');
    expect(toDateKey(instant, 'America/Bogota')).toBe('2026-10-12'); // UTC−5: todavía es el día anterior
    expect(toDateKey(instant, 'Asia/Tokyo')).toBe('2026-10-13'); // UTC+9
    expect(toDateKey(instant, 'Pacific/Kiritimati')).toBe('2026-10-13'); // UTC+14
  });

  it('rellena con ceros el mes y el día', () => {
    expect(toDateKey(new Date('2026-01-05T12:00:00Z'), 'UTC')).toBe('2026-01-05');
  });

  it('en el cambio de año, la zona horaria decide el año', () => {
    const newYear = new Date('2026-01-01T03:00:00Z');
    expect(toDateKey(newYear, 'UTC')).toBe('2026-01-01');
    expect(toDateKey(newYear, 'America/Bogota')).toBe('2025-12-31');
  });

  it('una zona inválida no falla: usa la del dispositivo', () => {
    expect(toDateKey(instant, 'Zona/Inexistente')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('sin zona usa la del dispositivo', () => {
    expect(toDateKey(instant)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('parseSessionForm', () => {
  it('acepta solo minutos', () => {
    expect(parse({ minutes: '30' })).toEqual({
      ok: true,
      data: { bookId: 'book1', date: NOW, dateKey: '2026-10-13', pagesRead: 0, durationMinutes: 30 },
    });
  });

  it('acepta solo la página final: parte de la página actual del libro', () => {
    const result = parse({ endPage: '130' });
    expect(result).toEqual({
      ok: true,
      data: { bookId: 'book1', date: NOW, dateKey: '2026-10-13', pagesRead: 30, durationMinutes: 0, startPage: 100, endPage: 130 },
    });
  });

  it('acepta minutos y página final a la vez, y las notas recortadas', () => {
    const result = parse({ minutes: '45', endPage: '160', notes: '  Capítulo difícil  ' });
    expect(result.ok && result.data).toMatchObject({ durationMinutes: 45, pagesRead: 60, notes: 'Capítulo difícil' });
  });

  it('con página inicial explícita, las páginas leídas salen de la diferencia', () => {
    const result = parse({ startPage: '50', endPage: '80' });
    expect(result.ok && result.data).toMatchObject({ startPage: 50, endPage: 80, pagesRead: 30 });
  });

  it('el dateKey sale de la zona horaria indicada', () => {
    const lateNight = new Date('2026-10-13T03:00:00Z');
    const bogota = parseSessionForm(form({ date: lateNight, minutes: '10' }), 'b', book, NOW, 'America/Bogota');
    expect(bogota.ok && bogota.data.dateKey).toBe('2026-10-12');
  });

  it('no incluye claves vacías ni undefined', () => {
    const result = parse({ minutes: '10' });
    expect(result.ok && Object.keys(result.data).sort()).toEqual(['bookId', 'date', 'dateKey', 'durationMinutes', 'pagesRead']);
  });

  it('exige minutos o página final', () => {
    const result = parse();
    expect(!result.ok && result.errors.general).toMatch(/minutos|página/);
  });

  it('una página final igual a la actual, sin minutos, no registra nada', () => {
    const result = parse({ endPage: '100' });
    expect(!result.ok && result.errors.general).toMatch(/misma página/);
  });

  it('una página final igual a la actual con minutos sí se guarda (leyó, pero no avanzó)', () => {
    const result = parse({ endPage: '100', minutes: '20' });
    expect(result.ok && result.data).toMatchObject({ pagesRead: 0, durationMinutes: 20 });
  });

  it('rechaza una página final anterior a la actual', () => {
    const result = parse({ endPage: '90' });
    expect(!result.ok && result.errors.endPage).toMatch(/Ibas por la página 100/);
  });

  it('rechaza una página final anterior a la inicial explícita', () => {
    const result = parse({ startPage: '80', endPage: '70' });
    expect(!result.ok && result.errors.endPage).toMatch(/anterior a la inicial/);
  });

  it('rechaza una página final por encima del total del libro', () => {
    const result = parse({ endPage: '301' });
    expect(!result.ok && result.errors.endPage).toMatch(/entre 0 y 300/);
  });

  it('sin total de páginas conocido acepta cualquier página hasta el máximo', () => {
    expect(parse({ endPage: '5000' }, { currentPage: 0 }).ok).toBe(true);
    expect(parse({ endPage: '100001' }, { currentPage: 0 }).ok).toBe(false);
  });

  it('la página inicial sola no basta', () => {
    const result = parse({ startPage: '10', minutes: '5' });
    expect(!result.ok && result.errors.endPage).toMatch(/página final/);
  });

  it.each(['abc', '-5', '1.5', '1e2', String(MAX_SESSION_MINUTES + 1)])('rechaza minutos inválidos: %s', (minutes) => {
    const result = parse({ minutes });
    expect(!result.ok && result.errors.minutes).toBeTruthy();
  });

  it('acepta el máximo de minutos', () => {
    expect(parse({ minutes: String(MAX_SESSION_MINUTES) }).ok).toBe(true);
  });

  it('rechaza una fecha futura, pero tolera un reloj adelantado unos segundos', () => {
    const future = parse({ date: new Date(NOW.getTime() + 60 * 60_000), minutes: '5' });
    expect(!future.ok && future.errors.date).toBeTruthy();
    expect(parse({ date: new Date(NOW.getTime() + 30_000), minutes: '5' }).ok).toBe(true);
  });

  it('rechaza una fecha inválida', () => {
    const result = parse({ date: new Date('no es una fecha'), minutes: '5' });
    expect(!result.ok && result.errors.date).toBeTruthy();
  });

  it('rechaza notas demasiado largas', () => {
    const result = parse({ minutes: '5', notes: 'a'.repeat(MAX_SESSION_NOTES + 1) });
    expect(!result.ok && result.errors.notes).toBeTruthy();
  });

  it('informa varios errores a la vez', () => {
    const result = parse({ minutes: 'x', endPage: '999' });
    expect(!result.ok && Object.keys(result.errors).sort()).toEqual(['endPage', 'minutes']);
  });
});

describe('planSessionBookUpdate', () => {
  const reading = { status: 'reading' as const, currentPage: 100, pageCount: 300, startedAt: {} };

  it('avanza la página actual a la página final', () => {
    expect(planSessionBookUpdate(reading, 130)).toMatchObject({ changed: true, currentPage: 130, status: 'reading' });
  });

  it('nunca retrocede la página (una sesión con fecha pasada no deshace un avance posterior)', () => {
    expect(planSessionBookUpdate(reading, 80)).toMatchObject({ changed: false });
    expect(planSessionBookUpdate(reading, 80).currentPage).toBeUndefined();
  });

  it('una sesión solo con minutos no cambia un libro que ya se está leyendo', () => {
    expect(planSessionBookUpdate(reading, undefined).changed).toBe(false);
  });

  it.each(['want_to_read', 'paused', 'abandoned'] as const)('un libro «%s» pasa a «Leyendo» al leer', (status) => {
    const plan = planSessionBookUpdate({ status, currentPage: 0, pageCount: 300 }, 20);
    expect(plan).toMatchObject({ changed: true, status: 'reading', currentPage: 20 });
  });

  it('al leer un libro pendiente por primera vez fija la fecha de inicio', () => {
    expect(planSessionBookUpdate({ status: 'want_to_read', currentPage: 0 }, 10).setStartedAt).toBe(true);
  });

  it('una sesión solo con minutos también pone a «Leyendo» un libro pendiente', () => {
    expect(planSessionBookUpdate({ status: 'want_to_read', currentPage: 0 }, undefined)).toMatchObject({
      changed: true,
      status: 'reading',
    });
  });

  it('al llegar a la última página pasa a «Terminado» con su fecha de fin', () => {
    const plan = planSessionBookUpdate(reading, 300);
    expect(plan).toMatchObject({ changed: true, status: 'finished', currentPage: 300, setFinishedAt: true });
  });

  it('sin total de páginas conocido nunca se termina solo', () => {
    const plan = planSessionBookUpdate({ status: 'reading', currentPage: 100, startedAt: {} }, 5000);
    expect(plan.status).toBe('reading');
    expect(plan.currentPage).toBe(5000);
  });

  it('un libro ya terminado conserva su estado', () => {
    const finished = { status: 'finished' as const, currentPage: 300, pageCount: 300, startedAt: {}, finishedAt: {} };
    expect(planSessionBookUpdate(finished, undefined).changed).toBe(false);
    expect(planSessionBookUpdate(finished, 300).changed).toBe(false);
  });

  it('un libro pendiente que se lee hasta el final pasa directamente a «Terminado»', () => {
    const plan = planSessionBookUpdate({ status: 'want_to_read', currentPage: 0, pageCount: 50 }, 50);
    expect(plan).toMatchObject({ status: 'finished', currentPage: 50, setStartedAt: true, setFinishedAt: true });
  });
});
