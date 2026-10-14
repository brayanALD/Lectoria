import { describeGoalProgress, getGoalProgress, MAX_DAILY_GOAL_MINUTES, parseGoalInput } from './dailyGoal';

describe('parseGoalInput', () => {
  it.each([
    ['30', 30],
    [' 45 ', 45],
    ['1', 1],
    ['1440', 1440],
  ])('acepta «%s»', (text, minutes) => {
    expect(parseGoalInput(text)).toEqual({ ok: true, minutes });
  });

  it.each([[''], ['   '], ['0'], ['1441'], ['-5'], ['12.5'], ['abc'], ['1e3']])('rechaza «%s»', (text) => {
    expect(parseGoalInput(text).ok).toBe(false);
  });

  it('el máximo coincide con el de las reglas de Firestore (1440 minutos, un día entero)', () => {
    expect(MAX_DAILY_GOAL_MINUTES).toBe(1440);
  });

  it('el mensaje de error indica el rango válido', () => {
    const result = parseGoalInput('0');
    expect(result.ok ? '' : result.error).toContain('1 a 1440');
  });
});

describe('getGoalProgress', () => {
  it('sin lectura: 0 %, falta toda la meta', () => {
    expect(getGoalProgress(0, 30)).toEqual({ goalMinutes: 30, minutes: 0, percent: 0, remaining: 30, met: false });
  });

  it('a medias: porcentaje entero y minutos que faltan', () => {
    expect(getGoalProgress(12, 30)).toMatchObject({ percent: 40, remaining: 18, met: false });
  });

  it('redondea siempre hacia abajo: 299 de 300 minutos no marca 100 %', () => {
    expect(getGoalProgress(299, 300)).toMatchObject({ percent: 99, remaining: 1, met: false });
  });

  it('justo en la meta se cumple', () => {
    expect(getGoalProgress(30, 30)).toMatchObject({ percent: 100, remaining: 0, met: true });
  });

  it('superar la meta no pasa de 100 % pero conserva los minutos leídos', () => {
    expect(getGoalProgress(75, 30)).toMatchObject({ minutes: 75, percent: 100, remaining: 0, met: true });
  });

  it('unos minutos negativos (dato inválido) cuentan como 0', () => {
    expect(getGoalProgress(-5, 30)).toMatchObject({ minutes: 0, percent: 0 });
  });
});

describe('describeGoalProgress', () => {
  it('hoy: «Faltan …» y, si se cumplió, «Meta cumplida»', () => {
    expect(describeGoalProgress(getGoalProgress(12, 30))).toBe('Faltan 18 min');
    expect(describeGoalProgress(getGoalProgress(30, 30))).toBe('Meta cumplida');
  });

  it('un día pasado habla en pasado', () => {
    expect(describeGoalProgress(getGoalProgress(12, 30), true)).toBe('Faltaron 18 min');
    expect(describeGoalProgress(getGoalProgress(40, 30), true)).toBe('Meta cumplida');
  });

  it('lo que falta se muestra en horas cuando corresponde', () => {
    expect(describeGoalProgress(getGoalProgress(0, 125))).toBe('Faltan 2 h 05 min');
  });
});
