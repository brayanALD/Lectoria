import { getIsbnErrorMessage, getScanFeedback, isValidIsbn10, isValidIsbn13, normalizeIsbn, parseIsbn, toIsbn13 } from './isbn';

describe('normalizeIsbn', () => {
  it('quita guiones y espacios y pasa a mayúsculas', () => {
    expect(normalizeIsbn(' 978-0-306-40615-7 ')).toBe('9780306406157');
    expect(normalizeIsbn('0-8044-2957-x')).toBe('080442957X');
  });
});

describe('isValidIsbn10', () => {
  it('acepta ISBN-10 con dígito de control correcto, incluida la X final', () => {
    expect(isValidIsbn10('0306406152')).toBe(true);
    expect(isValidIsbn10('080442957X')).toBe(true);
  });

  it('rechaza un dígito de control incorrecto o un formato inválido', () => {
    expect(isValidIsbn10('0306406153')).toBe(false);
    expect(isValidIsbn10('030640615')).toBe(false);
    expect(isValidIsbn10('03064061X2')).toBe(false); // la X solo puede ir al final
  });
});

describe('isValidIsbn13', () => {
  it('acepta ISBN-13 con dígito de control correcto', () => {
    expect(isValidIsbn13('9780306406157')).toBe(true);
    expect(isValidIsbn13('9780804429573')).toBe(true);
    expect(isValidIsbn13('9791090636071')).toBe(true); // prefijo 979
  });

  it('rechaza un dígito de control incorrecto', () => {
    expect(isValidIsbn13('9780306406158')).toBe(false);
  });

  it('rechaza códigos EAN-13 que no son de libros (prefijo distinto de 978 o 979)', () => {
    expect(isValidIsbn13('4006381333931')).toBe(false); // EAN-13 válido de un producto
  });
});

describe('toIsbn13', () => {
  it('convierte un ISBN-10 en su ISBN-13', () => {
    expect(toIsbn13('0306406152')).toBe('9780306406157');
    expect(toIsbn13('080442957X')).toBe('9780804429573');
  });

  it('el resultado siempre es un ISBN-13 válido', () => {
    for (const isbn10 of ['0306406152', '080442957X', '0441013597', '8437604184']) {
      if (isValidIsbn10(isbn10)) expect(isValidIsbn13(toIsbn13(isbn10))).toBe(true);
    }
  });
});

describe('parseIsbn', () => {
  it('devuelve el ISBN-13 para un ISBN-13 con o sin guiones', () => {
    expect(parseIsbn('978-0-306-40615-7')).toEqual({ ok: true, isbn13: '9780306406157' });
    expect(parseIsbn('9780306406157')).toEqual({ ok: true, isbn13: '9780306406157' });
  });

  it('convierte un ISBN-10 a ISBN-13', () => {
    expect(parseIsbn('0-306-40615-2')).toEqual({ ok: true, isbn13: '9780306406157' });
    expect(parseIsbn('080442957x')).toEqual({ ok: true, isbn13: '9780804429573' });
  });

  it('distingue vacío, formato y dígito de control', () => {
    expect(parseIsbn('   ')).toEqual({ ok: false, reason: 'empty' });
    expect(parseIsbn('12345')).toEqual({ ok: false, reason: 'format' });
    expect(parseIsbn('97803064061AB')).toEqual({ ok: false, reason: 'format' });
    expect(parseIsbn('9780306406158')).toEqual({ ok: false, reason: 'checksum' });
    expect(parseIsbn('0306406153')).toEqual({ ok: false, reason: 'checksum' });
  });

  it('un EAN-13 que no es de un libro es un error de formato', () => {
    expect(parseIsbn('4006381333931')).toEqual({ ok: false, reason: 'format' });
  });

  it('cada motivo de error tiene un mensaje', () => {
    for (const reason of ['empty', 'format', 'checksum'] as const) expect(getIsbnErrorMessage(reason)).toBeTruthy();
  });
});

describe('getScanFeedback', () => {
  it('avisa cuando el código no es de un libro', () => {
    expect(getScanFeedback('format')).toMatch(/no es de un libro/);
  });

  it('pide reintentar cuando la lectura es defectuosa', () => {
    expect(getScanFeedback('checksum')).toMatch(/Prueba de nuevo/);
  });

  it('no dice nada ante una lectura vacía', () => {
    expect(getScanFeedback('empty')).toBeNull();
  });

  it('con un EAN-13 de un producto que no es libro, parseIsbn y el aviso coinciden', () => {
    const result = parseIsbn('4006381333931');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(getScanFeedback(result.reason)).toMatch(/no es de un libro/);
  });
});
