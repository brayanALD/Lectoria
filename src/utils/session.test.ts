import type { SessionBookContext, SessionFormValues } from '../types/session';
import {
  MAX_SESSION_MINUTES,
  MAX_SESSION_NOTES,
  isReadingSession,
  parseProgressInput,
  parseSessionForm,
  planBookAfterSessionChange,
  planFinishReading,
  planProgressCorrection,
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

  describe('con la página inicial obligatoria (lectura pasada o edición)', () => {
    // El libro va por la página 100: ya no dice dónde empezó una lectura de otro día.
    const strict = (overrides: Partial<SessionFormValues> = {}) =>
      parseSessionForm(form(overrides), 'book1', book, NOW, 'UTC', true);

    it('pide la inicial cuando hay página final, en lugar de suponer la página actual', () => {
      const result = strict({ endPage: '60' });
      expect(result).toEqual({ ok: false, errors: { startPage: 'Indica la página inicial.' } });
    });

    it('pide la inicial aunque haya minutos', () => {
      const result = strict({ minutes: '30', endPage: '60' });
      expect(result.ok).toBe(false);
      expect(!result.ok && result.errors.startPage).toBeTruthy();
    });

    it('con la inicial, una lectura anterior a la página actual es válida: las páginas salen de la diferencia', () => {
      const result = strict({ startPage: '20', endPage: '60' });
      expect(result.ok && result.data).toMatchObject({ startPage: 20, endPage: 60, pagesRead: 40 });
    });

    it('no pide la inicial si no hay página final (solo minutos)', () => {
      const result = strict({ minutes: '25' });
      expect(result.ok && result.data).toMatchObject({ durationMinutes: 25, pagesRead: 0 });
      expect(result.ok && result.data.startPage).toBeUndefined();
    });

    it('una inicial inválida muestra su propio error, no «Indica la página inicial»', () => {
      const result = strict({ startPage: '999', endPage: '60' });
      expect(!result.ok && result.errors.startPage).toContain('entre 0 y 300');
    });

    it('la inicial no puede ser posterior a la final', () => {
      const result = strict({ startPage: '80', endPage: '60' });
      expect(!result.ok && result.errors.endPage).toBe('La página final no puede ser anterior a la inicial.');
    });

    it('por defecto (sin exigirla) sigue partiendo de la página actual', () => {
      const result = parse({ endPage: '130' });
      expect(result.ok && result.data).toMatchObject({ startPage: 100, pagesRead: 30 });
    });
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

describe('parseProgressInput', () => {
  it('acepta una página dentro del libro, incluidas la primera y la última', () => {
    expect(parseProgressInput('150', book)).toEqual({ ok: true, page: 150 });
    expect(parseProgressInput(' 0 ', book)).toEqual({ ok: true, page: 0 });
    expect(parseProgressInput('300', book)).toEqual({ ok: true, page: 300 });
  });

  it('rechaza vacío, texto, decimales, negativos y páginas por encima del total', () => {
    expect(parseProgressInput('', book)).toMatchObject({ ok: false, error: 'Introduce una página.' });
    for (const text of ['abc', '1.5', '-3', '301']) {
      expect(parseProgressInput(text, book)).toMatchObject({ ok: false, error: expect.stringMatching(/entre 0 y 300/) });
    }
  });

  it('sin total conocido acepta hasta el máximo', () => {
    expect(parseProgressInput('5000', { currentPage: 0 }).ok).toBe(true);
    expect(parseProgressInput('100001', { currentPage: 0 })).toMatchObject({ ok: false });
  });
});

describe('planProgressCorrection', () => {
  it('fija la página corregida sin tocar el estado de un libro que se está leyendo', () => {
    const plan = planProgressCorrection({ status: 'reading', currentPage: 100, pageCount: 300, startedAt: {} }, 40);
    expect(plan).toMatchObject({ status: 'reading', currentPage: 40, setFinishedAt: false, clearFinishedAt: false });
  });

  it('un libro terminado vuelve a «Leyendo» y pierde su fecha de fin', () => {
    const finished = { status: 'finished' as const, currentPage: 300, pageCount: 300, startedAt: {}, finishedAt: {} };
    expect(planProgressCorrection(finished, 250)).toMatchObject({ status: 'reading', currentPage: 250, clearFinishedAt: true });
  });

  it.each(['paused', 'abandoned', 'want_to_read'] as const)('un libro «%s» conserva su estado', (status) => {
    expect(planProgressCorrection({ status, currentPage: 80 }, 10)).toMatchObject({ status, currentPage: 10 });
  });
});

describe('planBookAfterSessionChange', () => {
  const reading = { status: 'reading' as const, currentPage: 120, pageCount: 300, startedAt: {} };
  const ends = (...pages: number[]) => pages.map((endPage) => ({ endPage }));

  describe('crear', () => {
    it('avanza igual que planSessionBookUpdate', () => {
      expect(planBookAfterSessionChange(reading, ends(50, 80), undefined, { endPage: 150 })).toMatchObject({
        changed: true,
        currentPage: 150,
      });
    });

    it('una sesión solo con minutos no mueve un libro que ya se lee', () => {
      expect(planBookAfterSessionChange(reading, ends(120), undefined, {}).changed).toBe(false);
    });
  });

  describe('eliminar', () => {
    it('eliminar la sesión que define el progreso devuelve el libro a la mayor página de las demás', () => {
      // Las demás terminaron en 100 y en 60; la eliminada (120) definía el progreso.
      const plan = planBookAfterSessionChange(reading, ends(100, 60), { endPage: 120 }, undefined);
      expect(plan).toMatchObject({ changed: true, currentPage: 100, status: 'reading' });
    });

    it('si no queda ninguna sesión con página, el libro vuelve a la página 0', () => {
      const plan = planBookAfterSessionChange(reading, [{}], { endPage: 120 }, undefined);
      expect(plan).toMatchObject({ changed: true, currentPage: 0 });
    });

    it('si otra sesión termina en la misma página, el progreso no cambia (no se retrocede)', () => {
      expect(planBookAfterSessionChange(reading, ends(120, 80), { endPage: 120 }, undefined).changed).toBe(false);
    });

    it('eliminar una sesión que no definía el progreso no toca el libro', () => {
      expect(planBookAfterSessionChange(reading, ends(120), { endPage: 80 }, undefined).changed).toBe(false);
    });

    it('eliminar una sesión sin páginas (solo minutos) no toca el libro', () => {
      expect(planBookAfterSessionChange(reading, ends(120), {}, undefined).changed).toBe(false);
    });

    it('no deshace una corrección a mano hacia atrás: la sesión eliminada ya no coincidía con la página', () => {
      // El usuario corrigió a 80 a mano; la sesión eliminada terminaba en 120.
      expect(planBookAfterSessionChange({ ...reading, currentPage: 80 }, ends(60), { endPage: 120 }, undefined).changed).toBe(false);
    });

    it('eliminar la sesión que terminó el libro lo devuelve a «Leyendo» sin fecha de fin', () => {
      const finished = { status: 'finished' as const, currentPage: 300, pageCount: 300, startedAt: {}, finishedAt: {} };
      const plan = planBookAfterSessionChange(finished, ends(250), { endPage: 300 }, undefined);
      expect(plan).toMatchObject({ changed: true, status: 'reading', currentPage: 250, clearFinishedAt: true });
    });
  });

  describe('editar', () => {
    it('bajar la página final de la sesión que define el progreso baja el libro (hasta la mayor página)', () => {
      const plan = planBookAfterSessionChange(reading, ends(60), { endPage: 120 }, { endPage: 90 });
      expect(plan).toMatchObject({ changed: true, currentPage: 90 });
    });

    it('bajarla por debajo de otra sesión deja el libro en esa otra', () => {
      const plan = planBookAfterSessionChange(reading, ends(100), { endPage: 120 }, { endPage: 30 });
      expect(plan).toMatchObject({ changed: true, currentPage: 100 });
    });

    it('subir la página final de la sesión que define el progreso sube el libro', () => {
      expect(planBookAfterSessionChange(reading, ends(60), { endPage: 120 }, { endPage: 180 })).toMatchObject({
        changed: true,
        currentPage: 180,
      });
    });

    it('subir una sesión antigua por encima de la página actual también sube el libro', () => {
      expect(planBookAfterSessionChange(reading, ends(120), { endPage: 50 }, { endPage: 200 })).toMatchObject({
        changed: true,
        currentPage: 200,
      });
    });

    it('editar una sesión antigua sin superar la página actual no cambia el libro', () => {
      expect(planBookAfterSessionChange(reading, ends(120), { endPage: 50 }, { endPage: 70 }).changed).toBe(false);
    });

    it('editar solo los minutos o las notas no cambia el libro', () => {
      expect(planBookAfterSessionChange(reading, ends(60), { endPage: 120 }, { endPage: 120 }).changed).toBe(false);
    });

    it('subir una sesión hasta la última página termina el libro', () => {
      expect(planBookAfterSessionChange(reading, ends(60), { endPage: 120 }, { endPage: 300 })).toMatchObject({
        changed: true,
        status: 'finished',
        currentPage: 300,
        setFinishedAt: true,
      });
    });

    it('quitar la página final de la sesión que define el progreso lo devuelve a la mayor de las demás', () => {
      expect(planBookAfterSessionChange(reading, ends(60), { endPage: 120 }, {})).toMatchObject({
        changed: true,
        currentPage: 60,
      });
    });
  });
});

describe('planFinishReading', () => {
  it('registra las páginas que faltaban, de la página actual a la última, sin minutos', () => {
    expect(planFinishReading('book1', { currentPage: 240, pageCount: 300 }, NOW, 'UTC')).toEqual({
      bookId: 'book1',
      date: NOW,
      dateKey: '2026-10-13',
      startPage: 240,
      endPage: 300,
      pagesRead: 60,
      durationMinutes: 0,
    });
  });

  it('desde la página 0 registra el libro entero', () => {
    expect(planFinishReading('book1', { currentPage: 0, pageCount: 300 }, NOW, 'UTC')).toMatchObject({
      startPage: 0,
      endPage: 300,
      pagesRead: 300,
    });
  });

  it('con una sola página pendiente registra esa página', () => {
    expect(planFinishReading('book1', { currentPage: 299, pageCount: 300 }, NOW, 'UTC')).toMatchObject({ pagesRead: 1 });
  });

  it('sin el total de páginas no inventa una cantidad: no hay sesión', () => {
    expect(planFinishReading('book1', { currentPage: 50 }, NOW, 'UTC')).toBeUndefined();
    expect(planFinishReading('book1', { currentPage: 50, pageCount: 0 }, NOW, 'UTC')).toBeUndefined();
  });

  it('si el libro ya está en la última página no hay nada que registrar (no duplica lecturas)', () => {
    expect(planFinishReading('book1', { currentPage: 300, pageCount: 300 }, NOW, 'UTC')).toBeUndefined();
    expect(planFinishReading('book1', { currentPage: 320, pageCount: 300 }, NOW, 'UTC')).toBeUndefined();
  });

  it('el día de la sesión es el de la zona horaria indicada', () => {
    const lateNight = new Date('2026-10-14T03:30:00Z');
    expect(planFinishReading('book1', book, lateNight, 'UTC')?.dateKey).toBe('2026-10-14');
    expect(planFinishReading('book1', book, lateNight, 'America/Bogota')?.dateKey).toBe('2026-10-13');
  });

  it('la sesión resultante sirve para terminar el libro y cuenta como día de lectura si son más de 1 página', () => {
    const reading = planFinishReading('book1', book, NOW, 'UTC');
    expect(reading).toBeDefined();
    expect(planSessionBookUpdate({ ...book, status: 'paused' }, reading?.endPage)).toMatchObject({
      status: 'finished',
      currentPage: 300,
      setFinishedAt: true,
      changed: true,
    });
    expect(isReadingSession(reading as { durationMinutes: number; pagesRead: number })).toBe(true);
    const lastPage = planFinishReading('book1', { currentPage: 299, pageCount: 300 }, NOW, 'UTC');
    expect(isReadingSession(lastPage as { durationMinutes: number; pagesRead: number })).toBe(false);
  });
});
