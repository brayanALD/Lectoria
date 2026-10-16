import {
  describeMonthlyGoalProgress,
  describeMonthlyGoalSummary,
  formatBooks,
  getMonthlyGoalProgress,
  MONTHLY_BOOKS_GOAL_LIMITS,
  parseMonthlyGoalInput,
} from './monthlyGoal';

describe('parseMonthlyGoalInput', () => {
  it('acepta un entero dentro de los límites, con espacios alrededor', () => {
    expect(parseMonthlyGoalInput('4')).toEqual({ ok: true, target: 4 });
    expect(parseMonthlyGoalInput('  12 ')).toEqual({ ok: true, target: 12 });
  });

  it('acepta los dos límites', () => {
    expect(parseMonthlyGoalInput(String(MONTHLY_BOOKS_GOAL_LIMITS.min))).toEqual({ ok: true, target: 1 });
    expect(parseMonthlyGoalInput(String(MONTHLY_BOOKS_GOAL_LIMITS.max))).toEqual({ ok: true, target: 1000 });
  });

  it('pide un número si está vacío', () => {
    expect(parseMonthlyGoalInput('   ')).toEqual({ ok: false, error: 'Introduce el número de libros de tu objetivo.' });
  });

  it.each(['0', '1001', '-3', '2.5', '2,5', 'tres', '1e2', '+4'])('rechaza %j', (text) => {
    expect(parseMonthlyGoalInput(text)).toEqual({
      ok: false,
      error: 'Introduce un número entero de libros (de 1 a 1000).',
    });
  });
});

describe('formatBooks', () => {
  it('concuerda en singular y plural', () => {
    expect(formatBooks(0)).toBe('0 libros');
    expect(formatBooks(1)).toBe('1 libro');
    expect(formatBooks(2)).toBe('2 libros');
  });
});

describe('getMonthlyGoalProgress', () => {
  it('sin libros terminados el avance es 0', () => {
    expect(getMonthlyGoalProgress(0, 4)).toEqual({ target: 4, value: 0, percent: 0, remaining: 4, met: false });
  });

  it('calcula el porcentaje hacia abajo: nunca llega a 100 sin cumplir', () => {
    expect(getMonthlyGoalProgress(1, 3)).toMatchObject({ percent: 33, remaining: 2, met: false });
    expect(getMonthlyGoalProgress(199, 200)).toMatchObject({ percent: 99, met: false });
    expect(getMonthlyGoalProgress(999, 1000)).toMatchObject({ percent: 99, met: false });
  });

  it('se cumple al llegar al objetivo y también al superarlo', () => {
    expect(getMonthlyGoalProgress(4, 4)).toEqual({ target: 4, value: 4, percent: 100, remaining: 0, met: true });
    expect(getMonthlyGoalProgress(7, 4)).toMatchObject({ value: 7, percent: 100, remaining: 0, met: true });
  });

  it('un objetivo de 1 libro se cumple con el primero', () => {
    expect(getMonthlyGoalProgress(0, 1)).toMatchObject({ percent: 0, met: false });
    expect(getMonthlyGoalProgress(1, 1)).toMatchObject({ percent: 100, met: true });
  });

  it('no admite un conteo negativo', () => {
    expect(getMonthlyGoalProgress(-2, 4)).toMatchObject({ value: 0, percent: 0, remaining: 4 });
  });
});

describe('textos del objetivo', () => {
  it('resume lo terminado frente al objetivo', () => {
    expect(describeMonthlyGoalSummary(getMonthlyGoalProgress(2, 5))).toBe('2 de 5 libros');
    expect(describeMonthlyGoalSummary(getMonthlyGoalProgress(0, 1))).toBe('0 de 1 libro');
  });

  it('dice lo que falta en presente y, en un mes pasado, en pasado', () => {
    expect(describeMonthlyGoalProgress(getMonthlyGoalProgress(2, 5))).toBe('Faltan 3 libros');
    expect(describeMonthlyGoalProgress(getMonthlyGoalProgress(4, 5))).toBe('Falta 1 libro');
    expect(describeMonthlyGoalProgress(getMonthlyGoalProgress(2, 5), true)).toBe('Faltaron 3 libros');
    expect(describeMonthlyGoalProgress(getMonthlyGoalProgress(4, 5), true)).toBe('Faltó 1 libro');
  });

  it('un objetivo cumplido lo dice igual en cualquier mes', () => {
    expect(describeMonthlyGoalProgress(getMonthlyGoalProgress(5, 5))).toBe('Objetivo cumplido');
    expect(describeMonthlyGoalProgress(getMonthlyGoalProgress(6, 5), true)).toBe('Objetivo cumplido');
  });
});
