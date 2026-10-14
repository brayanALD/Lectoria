import type { DailyGoal } from '../types/goal';
import {
  describeGoalProgress,
  describeGoalSummary,
  formatGoalValue,
  getGoalProgress,
  GOAL_LIMITS,
  GOAL_TYPE_LABELS,
  parseGoalInput,
} from './dailyGoal';

const minutesGoal = (target: number): DailyGoal => ({ type: 'minutes', target });
const pagesGoal = (target: number): DailyGoal => ({ type: 'pages', target });

describe('parseGoalInput', () => {
  it.each([
    ['30', 'minutes', 30],
    [' 45 ', 'minutes', 45],
    ['1', 'minutes', 1],
    ['1440', 'minutes', 1440],
    ['20', 'pages', 20],
    ['1', 'pages', 1],
    ['10000', 'pages', 10000],
  ] as const)('acepta «%s» como meta de %s', (text, type, target) => {
    expect(parseGoalInput(text, type)).toEqual({ ok: true, target });
  });

  it.each([[''], ['   '], ['0'], ['-5'], ['12.5'], ['abc'], ['1e3']])('rechaza «%s» en ambos tipos', (text) => {
    expect(parseGoalInput(text, 'minutes').ok).toBe(false);
    expect(parseGoalInput(text, 'pages').ok).toBe(false);
  });

  it('cada tipo tiene su propio máximo: 1441 minutos no vale, 1441 páginas sí', () => {
    expect(parseGoalInput('1441', 'minutes').ok).toBe(false);
    expect(parseGoalInput('1441', 'pages')).toEqual({ ok: true, target: 1441 });
    expect(parseGoalInput('10001', 'pages').ok).toBe(false);
  });

  it('los límites coinciden con los de las reglas de Firestore', () => {
    expect(GOAL_LIMITS).toEqual({ minutes: { min: 1, max: 1440 }, pages: { min: 1, max: 10000 } });
  });

  it('el mensaje de error nombra la unidad y el rango del tipo elegido', () => {
    const minutes = parseGoalInput('0', 'minutes');
    const pages = parseGoalInput('0', 'pages');
    expect(minutes.ok ? '' : minutes.error).toBe('Introduce un número entero de minutos (de 1 a 1440).');
    expect(pages.ok ? '' : pages.error).toBe('Introduce un número entero de páginas (de 1 a 10000).');
    const emptyMinutes = parseGoalInput('', 'minutes');
    const emptyPages = parseGoalInput('', 'pages');
    expect(emptyMinutes.ok ? '' : emptyMinutes.error).toBe('Introduce los minutos de tu meta.');
    expect(emptyPages.ok ? '' : emptyPages.error).toBe('Introduce las páginas de tu meta.');
  });
});

describe('GOAL_TYPE_LABELS / formatGoalValue', () => {
  it('nombra los dos tipos', () => {
    expect(GOAL_TYPE_LABELS).toEqual({ minutes: 'Minutos', pages: 'Páginas' });
  });

  it('formatea los minutos como duración y las páginas con su unidad', () => {
    expect(formatGoalValue('minutes', 45)).toBe('45 min');
    expect(formatGoalValue('minutes', 125)).toBe('2 h 05 min');
    expect(formatGoalValue('pages', 1)).toBe('1 pág');
    expect(formatGoalValue('pages', 20)).toBe('20 págs');
  });
});

describe('getGoalProgress con meta de minutos', () => {
  it('sin lectura: 0 %, falta toda la meta', () => {
    expect(getGoalProgress({ minutes: 0, pages: 0 }, minutesGoal(30))).toEqual({
      type: 'minutes',
      target: 30,
      value: 0,
      percent: 0,
      remaining: 30,
      met: false,
    });
  });

  it('a medias: porcentaje entero y minutos que faltan', () => {
    expect(getGoalProgress({ minutes: 12, pages: 0 }, minutesGoal(30))).toMatchObject({ percent: 40, remaining: 18, met: false });
  });

  it('redondea siempre hacia abajo: 299 de 300 minutos no marca 100 %', () => {
    expect(getGoalProgress({ minutes: 299, pages: 0 }, minutesGoal(300))).toMatchObject({ percent: 99, remaining: 1, met: false });
  });

  it('justo en la meta se cumple, y superarla no pasa de 100 % pero conserva lo leído', () => {
    expect(getGoalProgress({ minutes: 30, pages: 0 }, minutesGoal(30))).toMatchObject({ percent: 100, remaining: 0, met: true });
    expect(getGoalProgress({ minutes: 75, pages: 0 }, minutesGoal(30))).toMatchObject({ value: 75, percent: 100, met: true });
  });

  it('ignora las páginas: solo cuentan los minutos', () => {
    expect(getGoalProgress({ minutes: 10, pages: 500 }, minutesGoal(30))).toMatchObject({ value: 10, met: false });
  });

  it('un valor negativo (dato inválido) cuenta como 0', () => {
    expect(getGoalProgress({ minutes: -5, pages: 0 }, minutesGoal(30))).toMatchObject({ value: 0, percent: 0 });
  });
});

describe('getGoalProgress con meta de páginas', () => {
  it('mide las páginas leídas, no los minutos', () => {
    const progress = getGoalProgress({ minutes: 600, pages: 8 }, pagesGoal(20));
    expect(progress).toEqual({ type: 'pages', target: 20, value: 8, percent: 40, remaining: 12, met: false });
  });

  it('una lectura de solo minutos (sin páginas) no avanza una meta de páginas', () => {
    expect(getGoalProgress({ minutes: 90, pages: 0 }, pagesGoal(20))).toMatchObject({ value: 0, percent: 0, met: false });
  });

  it('una lectura de solo páginas (sin minutos) sí avanza una meta de páginas', () => {
    expect(getGoalProgress({ minutes: 0, pages: 25 }, pagesGoal(20))).toMatchObject({ percent: 100, remaining: 0, met: true });
  });

  it('también redondea hacia abajo', () => {
    expect(getGoalProgress({ minutes: 0, pages: 19 }, pagesGoal(20))).toMatchObject({ percent: 95, remaining: 1, met: false });
    expect(getGoalProgress({ minutes: 0, pages: 199 }, pagesGoal(200))).toMatchObject({ percent: 99, met: false });
  });

  it('con la misma lectura, el cumplimiento depende del tipo de meta', () => {
    const reading = { minutes: 30, pages: 5 };
    expect(getGoalProgress(reading, minutesGoal(30)).met).toBe(true);
    expect(getGoalProgress(reading, pagesGoal(30)).met).toBe(false);
  });
});

describe('describeGoalSummary / describeGoalProgress', () => {
  it('resume lo leído frente a la meta, con la unidad del tipo', () => {
    expect(describeGoalSummary(getGoalProgress({ minutes: 12, pages: 0 }, minutesGoal(30)))).toBe('12 min de 30 min');
    expect(describeGoalSummary(getGoalProgress({ minutes: 0, pages: 8 }, pagesGoal(20)))).toBe('8 págs de 20 págs');
    expect(describeGoalSummary(getGoalProgress({ minutes: 0, pages: 1 }, pagesGoal(1)))).toBe('1 pág de 1 pág');
  });

  it('hoy: «Faltan …» y, si se cumplió, «Meta cumplida»', () => {
    expect(describeGoalProgress(getGoalProgress({ minutes: 12, pages: 0 }, minutesGoal(30)))).toBe('Faltan 18 min');
    expect(describeGoalProgress(getGoalProgress({ minutes: 0, pages: 8 }, pagesGoal(20)))).toBe('Faltan 12 págs');
    expect(describeGoalProgress(getGoalProgress({ minutes: 30, pages: 0 }, minutesGoal(30)))).toBe('Meta cumplida');
  });

  it('un día pasado habla en pasado', () => {
    expect(describeGoalProgress(getGoalProgress({ minutes: 12, pages: 0 }, minutesGoal(30)), true)).toBe('Faltaron 18 min');
    expect(describeGoalProgress(getGoalProgress({ minutes: 0, pages: 8 }, pagesGoal(20)), true)).toBe('Faltaron 12 págs');
    expect(describeGoalProgress(getGoalProgress({ minutes: 40, pages: 0 }, minutesGoal(30)), true)).toBe('Meta cumplida');
  });

  it('lo que falta en minutos se muestra en horas cuando corresponde', () => {
    expect(describeGoalProgress(getGoalProgress({ minutes: 0, pages: 0 }, minutesGoal(125)))).toBe('Faltan 2 h 05 min');
  });
});
