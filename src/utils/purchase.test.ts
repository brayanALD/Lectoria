import { MAX_PRICE, describePurchase, formatPrice, parsePriceInput, parsePurchaseForm } from './purchase';

const NOW = new Date(2026, 9, 15, 18, 30, 0); // 15 de octubre de 2026, 18:30 locales
const TODAY = '2026-10-15';

const price = (text: string) => {
  const result = parsePriceInput(text);
  if (!result.ok) throw new Error(`precio rechazado: ${text}`);
  return result.price;
};

describe('parsePriceInput', () => {
  it('vacío significa sin precio', () => {
    expect(parsePriceInput('')).toEqual({ ok: true });
    expect(parsePriceInput('   ')).toEqual({ ok: true });
  });

  it('acepta enteros, también el cero', () => {
    expect(price('45000')).toBe(45000);
    expect(price('0')).toBe(0);
    expect(price(' 120 ')).toBe(120);
  });

  it('un separador seguido de 1 o 2 cifras es decimal', () => {
    expect(price('45,5')).toBe(45.5);
    expect(price('45.50')).toBe(45.5);
    expect(price('0,99')).toBe(0.99);
    expect(price('12.3')).toBe(12.3);
  });

  it('un separador seguido de 3 cifras separa miles', () => {
    expect(price('45.000')).toBe(45000);
    expect(price('45,000')).toBe(45000);
    expect(price('1.234.567')).toBe(1234567);
    expect(price('1,234,567')).toBe(1234567);
  });

  it('con los dos separadores, el último es el decimal', () => {
    expect(price('1.234,50')).toBe(1234.5);
    expect(price('1,234.50')).toBe(1234.5);
    expect(price('1.234.567,8')).toBe(1234567.8);
  });

  it('redondea a dos decimales', () => {
    expect(price('10,005')).toBe(10005);
    expect(price('10.999')).toBe(10999);
  });

  it.each(['abc', '12abc', '-5', '+5', '1e3', '12.3456', '1.2.3', '1.23.456', '1,234.567', '45.', ',5', '.5', '4 5'])(
    'rechaza %j',
    (text) => {
      const result = parsePriceInput(text);
      expect(result.ok).toBe(false);
    },
  );

  it('rechaza lo que supera el máximo y acepta el máximo exacto', () => {
    expect(price(String(MAX_PRICE))).toBe(MAX_PRICE);
    expect(parsePriceInput(String(MAX_PRICE + 1)).ok).toBe(false);
  });
});

describe('formatPrice', () => {
  it('usa el formato del español, sin moneda', () => {
    expect(formatPrice(45000)).toBe('45.000');
    expect(formatPrice(45.5)).toBe('45,5');
    expect(formatPrice(0)).toBe('0');
    expect(formatPrice(1234567.89)).toBe('1.234.567,89');
  });
});

describe('parsePurchaseForm', () => {
  it('hoy conserva la hora actual y el precio es opcional', () => {
    expect(parsePurchaseForm({ dateKey: TODAY, price: '' }, NOW, TODAY)).toEqual({
      ok: true,
      data: { purchasedAt: NOW },
    });
  });

  it('un día pasado se guarda al mediodía, para que ninguna zona horaria lo cambie de día', () => {
    const result = parsePurchaseForm({ dateKey: '2026-10-01', price: '45.000' }, NOW, TODAY);
    expect(result).toEqual({ ok: true, data: { purchasedAt: new Date(2026, 9, 1, 12, 0, 0), price: 45000 } });
  });

  it('rechaza una fecha futura, vacía o mal formada', () => {
    expect(parsePurchaseForm({ dateKey: '2026-10-16', price: '' }, NOW, TODAY)).toEqual({
      ok: false,
      errors: { date: 'La fecha de compra no puede ser futura.' },
    });
    for (const dateKey of ['', 'ayer', '2026-1-5']) {
      expect(parsePurchaseForm({ dateKey, price: '' }, NOW, TODAY)).toMatchObject({
        ok: false,
        errors: { date: 'Elige la fecha de la compra.' },
      });
    }
  });

  it('rechaza un precio inválido y a la vez informa de la fecha', () => {
    const result = parsePurchaseForm({ dateKey: '2027-01-01', price: 'gratis' }, NOW, TODAY);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.date).toBeDefined();
      expect(result.errors.price).toBeDefined();
    }
  });

  it('no incluye claves con valor undefined (Firestore las rechaza)', () => {
    const result = parsePurchaseForm({ dateKey: TODAY, price: '' }, NOW, TODAY);
    if (!result.ok) throw new Error('se esperaba un resultado válido');
    expect(Object.keys(result.data)).toEqual(['purchasedAt']);
  });
});

describe('describePurchase', () => {
  const at = (date: Date) => ({ toDate: () => date });

  it('junta la fecha y el precio, o solo lo que haya', () => {
    const date = at(new Date(2026, 9, 13, 12, 0, 0));
    expect(describePurchase({ purchasedAt: date, price: 45000 })).toBe('13 de octubre de 2026 · 45.000');
    expect(describePurchase({ purchasedAt: date })).toBe('13 de octubre de 2026');
    expect(describePurchase({ price: 0 })).toBe('0');
  });

  it('sin datos de compra devuelve undefined', () => {
    expect(describePurchase({})).toBeUndefined();
  });
});
