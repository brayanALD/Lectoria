import {
  buildTimerDraft,
  describeClock,
  elapsedToMinutes,
  formatClock,
  getElapsedMs,
  isTimerRunning,
  parseStoredTimer,
  pauseTimer,
  resumeTimer,
  serializeTimer,
  startTimer,
  timerSessionId,
} from './readingTimer';
import { MAX_SESSION_MINUTES, toDateKey } from './session';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const T0 = new Date('2026-10-13T15:00:00Z').getTime();

describe('cronómetro con marcas de tiempo', () => {
  it('al iniciar está en marcha y mide desde ese instante', () => {
    const timer = startTimer('libro1', T0);
    expect(isTimerRunning(timer)).toBe(true);
    expect(getElapsedMs(timer, T0)).toBe(0);
    expect(getElapsedMs(timer, T0 + 90 * SECOND)).toBe(90 * SECOND);
  });

  it('pausar congela el tiempo: lo que pase después no cuenta', () => {
    const paused = pauseTimer(startTimer('libro1', T0), T0 + 10 * MINUTE);
    expect(isTimerRunning(paused)).toBe(false);
    expect(getElapsedMs(paused, T0 + 10 * MINUTE)).toBe(10 * MINUTE);
    expect(getElapsedMs(paused, T0 + 5 * HOUR)).toBe(10 * MINUTE);
  });

  it('reanudar suma un tramo nuevo al acumulado', () => {
    const paused = pauseTimer(startTimer('libro1', T0), T0 + 10 * MINUTE);
    const resumed = resumeTimer(paused, T0 + 30 * MINUTE);
    expect(isTimerRunning(resumed)).toBe(true);
    expect(getElapsedMs(resumed, T0 + 45 * MINUTE)).toBe(25 * MINUTE); // 10 + 15
  });

  it('varias pausas y reanudaciones acumulan solo el tiempo en marcha', () => {
    let timer = startTimer('libro1', T0);
    timer = pauseTimer(timer, T0 + 5 * MINUTE); // 5
    timer = resumeTimer(timer, T0 + 20 * MINUTE);
    timer = pauseTimer(timer, T0 + 28 * MINUTE); // +8 = 13
    timer = resumeTimer(timer, T0 + HOUR);
    expect(getElapsedMs(timer, T0 + HOUR + 2 * MINUTE)).toBe(15 * MINUTE);
  });

  it('el tiempo se calcula con marcas, no con un contador: una app en segundo plano horas sigue contando', () => {
    const timer = startTimer('libro1', T0);
    // Nadie «dio» ningún tick durante tres horas; al volver, el tiempo está completo.
    expect(getElapsedMs(timer, T0 + 3 * HOUR)).toBe(3 * HOUR);
  });

  it('pausar dos veces o reanudar dos veces no cambia nada (no se cuenta dos veces)', () => {
    const running = startTimer('libro1', T0);
    expect(resumeTimer(running, T0 + MINUTE)).toBe(running);

    const paused = pauseTimer(running, T0 + MINUTE);
    expect(pauseTimer(paused, T0 + 9 * MINUTE)).toBe(paused);
  });

  it('un reloj que retrocede nunca da tiempo negativo', () => {
    const timer = startTimer('libro1', T0);
    expect(getElapsedMs(timer, T0 - HOUR)).toBe(0);
    expect(getElapsedMs(pauseTimer(timer, T0 - HOUR), T0)).toBe(0);
  });

  it('conserva el libro y el instante de inicio al pausar y reanudar', () => {
    const resumed = resumeTimer(pauseTimer(startTimer('libro1', T0), T0 + MINUTE), T0 + 2 * MINUTE);
    expect(resumed).toMatchObject({ bookId: 'libro1', startedAt: T0 });
  });
});

describe('elapsedToMinutes', () => {
  it.each([
    [0, 0],
    [29 * SECOND, 0],
    [30 * SECOND, 1],
    [89 * SECOND, 1],
    [90 * SECOND, 2],
    [25 * MINUTE, 25],
    [2 * HOUR + 5 * MINUTE, 125],
  ])('%i ms → %i min', (ms, expected) => {
    expect(elapsedToMinutes(ms)).toBe(expected);
  });

  it('un cronómetro olvidado no pasa del máximo de una sesión (24 h)', () => {
    expect(elapsedToMinutes(30 * HOUR)).toBe(MAX_SESSION_MINUTES);
  });

  it('un valor negativo cuenta como cero', () => {
    expect(elapsedToMinutes(-5 * MINUTE)).toBe(0);
  });
});

describe('formatClock / describeClock', () => {
  it.each([
    [0, '00:00'],
    [9 * SECOND, '00:09'],
    [65 * SECOND, '01:05'],
    [59 * MINUTE + 59 * SECOND, '59:59'],
    [HOUR, '1:00:00'],
    [HOUR + 5 * MINUTE + 9 * SECOND, '1:05:09'],
    [26 * HOUR, '26:00:00'],
    [-1000, '00:00'],
  ])('%i ms → %s', (ms, expected) => {
    expect(formatClock(ms)).toBe(expected);
  });

  it('no redondea hacia arriba los segundos', () => {
    expect(formatClock(59_999)).toBe('00:59');
  });

  it.each([
    [0, '0 segundos'],
    [SECOND, '1 segundo'],
    [9 * SECOND, '9 segundos'],
    [MINUTE, '1 minuto y 0 segundos'],
    [5 * MINUTE + 9 * SECOND, '5 minutos y 9 segundos'],
    [HOUR + 5 * MINUTE + 9 * SECOND, '1 hora, 5 minutos y 9 segundos'],
    [2 * HOUR, '2 horas, 0 minutos y 0 segundos'],
  ])('describe %i ms como «%s»', (ms, expected) => {
    expect(describeClock(ms)).toBe(expected);
  });
});

describe('timerSessionId / buildTimerDraft', () => {
  it('el id de la sesión depende solo del cronómetro: no cambia al pausar ni reanudar', () => {
    const timer = startTimer('libro1', T0);
    const later = resumeTimer(pauseTimer(timer, T0 + MINUTE), T0 + 2 * MINUTE);
    expect(timerSessionId(timer)).toBe(`timer-${T0}`);
    expect(timerSessionId(later)).toBe(timerSessionId(timer));
  });

  it('dos cronómetros distintos no comparten id', () => {
    expect(timerSessionId(startTimer('libro1', T0))).not.toBe(timerSessionId(startTimer('libro1', T0 + 1)));
  });

  it('el borrador lleva el libro, los minutos redondeados, el día de inicio y el id', () => {
    const timer = pauseTimer(startTimer('libro1', T0), T0 + 25 * MINUTE + 20 * SECOND);
    expect(buildTimerDraft(timer, T0 + 10 * HOUR)).toEqual({
      bookId: 'libro1',
      minutes: '25',
      dayKey: toDateKey(new Date(T0)),
      sessionId: `timer-${T0}`,
    });
  });

  it('con menos de medio minuto, los minutos van vacíos para que la persona los indique', () => {
    const timer = pauseTimer(startTimer('libro1', T0), T0 + 10 * SECOND);
    expect(buildTimerDraft(timer, T0 + HOUR).minutes).toBe('');
  });

  it('un cronómetro todavía en marcha se mide hasta el momento de crear el borrador', () => {
    expect(buildTimerDraft(startTimer('libro1', T0), T0 + 7 * MINUTE).minutes).toBe('7');
  });

  it('un cronómetro olvidado queda limitado a 24 h', () => {
    expect(buildTimerDraft(startTimer('libro1', T0), T0 + 40 * HOUR).minutes).toBe(String(MAX_SESSION_MINUTES));
  });

  it('el día es el de inicio, no el de fin, aunque la sesión cruce la medianoche', () => {
    const start = new Date(2026, 9, 13, 23, 50).getTime();
    const draft = buildTimerDraft(pauseTimer(startTimer('libro1', start), start + 30 * MINUTE), start + HOUR);
    expect(draft.dayKey).toBe('2026-10-13');
  });
});

describe('guardado del cronómetro', () => {
  it('se recupera exactamente lo guardado, en marcha o en pausa', () => {
    const running = startTimer('libro1', T0);
    const paused = pauseTimer(running, T0 + MINUTE);
    expect(parseStoredTimer(serializeTimer(running))).toEqual(running);
    expect(parseStoredTimer(serializeTimer(paused))).toEqual(paused);
  });

  it('un cronómetro en marcha restaurado sigue contando desde su marca (cierre accidental de la app)', () => {
    const restored = parseStoredTimer(serializeTimer(startTimer('libro1', T0)));
    expect(restored && getElapsedMs(restored, T0 + 12 * MINUTE)).toBe(12 * MINUTE);
  });

  it.each([
    ['nada guardado', null],
    ['texto vacío', ''],
    ['JSON roto', '{"bookId":'],
    ['no es un objeto', '42'],
    ['null', 'null'],
    ['sin libro', JSON.stringify({ startedAt: 1, accumulatedMs: 0 })],
    ['libro vacío', JSON.stringify({ bookId: '', startedAt: 1, accumulatedMs: 0 })],
    ['inicio no numérico', JSON.stringify({ bookId: 'a', startedAt: '1', accumulatedMs: 0 })],
    ['acumulado negativo', JSON.stringify({ bookId: 'a', startedAt: 1, accumulatedMs: -5 })],
    ['marca no finita', JSON.stringify({ bookId: 'a', startedAt: 1, accumulatedMs: 0, runningSince: 'x' })],
  ])('descarta un dato inválido: %s', (_name, raw) => {
    expect(parseStoredTimer(raw)).toBeUndefined();
  });

  it('ignora los campos desconocidos', () => {
    const raw = JSON.stringify({ bookId: 'a', startedAt: 1, accumulatedMs: 2, extra: true });
    expect(parseStoredTimer(raw)).toEqual({ bookId: 'a', startedAt: 1, accumulatedMs: 2 });
  });
});
