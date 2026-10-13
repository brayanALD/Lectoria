import type { BookFormValues } from '../types/book';
import {
  EMPTY_BOOK_FORM,
  MAX_AUTHORS,
  MAX_PAGE_COUNT,
  MAX_TITLE_LENGTH,
  READING_STATUSES,
  READING_STATUS_LABELS,
  parseBookForm,
  splitList,
} from './book';

const form = (overrides: Partial<BookFormValues> = {}): BookFormValues => ({
  ...EMPTY_BOOK_FORM,
  title: 'Dune',
  authors: 'Frank Herbert',
  ...overrides,
});

describe('splitList', () => {
  it('separa por coma, punto y coma o salto de línea, recortando espacios', () => {
    expect(splitList(' A , B;C\nD ')).toEqual(['A', 'B', 'C', 'D']);
  });

  it('descarta vacíos y duplicados sin distinguir mayúsculas, conservando la primera grafía', () => {
    expect(splitList('Ana,, ana ,ANA;  Luis')).toEqual(['Ana', 'Luis']);
  });

  it('colapsa los espacios internos repetidos', () => {
    expect(splitList('Gabriel   García  Márquez')).toEqual(['Gabriel García Márquez']);
  });

  it('devuelve una lista vacía para texto vacío', () => {
    expect(splitList('  ,; ')).toEqual([]);
  });
});

describe('READING_STATUS_LABELS', () => {
  it('tiene una etiqueta para cada estado', () => {
    for (const status of READING_STATUSES) expect(READING_STATUS_LABELS[status]).toBeTruthy();
  });
});

describe('parseBookForm', () => {
  it('acepta solo título y autor, con valores por defecto', () => {
    expect(parseBookForm(form())).toEqual({
      ok: true,
      data: { title: 'Dune', authors: ['Frank Herbert'], status: 'want_to_read', acquisition: 'owned', currentPage: 0 },
    });
  });

  it('no incluye claves con valor undefined (Firestore las rechaza)', () => {
    const result = parseBookForm(form());
    if (!result.ok) throw new Error('se esperaba un resultado válido');
    expect(Object.keys(result.data).sort()).toEqual(['acquisition', 'authors', 'currentPage', 'status', 'title']);
    expect(Object.values(result.data).every((value) => value !== undefined)).toBe(true);
  });

  it('convierte los campos opcionales cuando se indican', () => {
    const result = parseBookForm(
      form({
        title: '  El   nombre del viento ',
        authors: 'Patrick Rothfuss',
        pageCount: '662',
        genres: 'Fantasía; Aventura',
        seriesName: 'Crónica del asesino de reyes',
        seriesOrder: '1',
        status: 'reading',
      }),
    );
    expect(result).toEqual({
      ok: true,
      data: {
        title: 'El nombre del viento',
        authors: ['Patrick Rothfuss'],
        pageCount: 662,
        genres: ['Fantasía', 'Aventura'],
        seriesName: 'Crónica del asesino de reyes',
        seriesOrder: 1,
        status: 'reading',
        acquisition: 'owned',
        currentPage: 0,
      },
    });
  });

  it('un libro terminado con total de páginas conocido queda en la última página', () => {
    const result = parseBookForm(form({ status: 'finished', pageCount: '300' }));
    expect(result.ok && result.data.currentPage).toBe(300);
  });

  it('un libro terminado sin total de páginas queda en la página 0', () => {
    const result = parseBookForm(form({ status: 'finished' }));
    expect(result.ok && result.data.currentPage).toBe(0);
  });

  it('exige título y al menos un autor', () => {
    const result = parseBookForm(form({ title: '   ', authors: ' , ' }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(['authors', 'title']);
  });

  it('rechaza título demasiado largo y demasiados autores', () => {
    const tooMany = Array.from({ length: MAX_AUTHORS + 1 }, (_, i) => `Autor ${i}`).join(',');
    const result = parseBookForm(form({ title: 'a'.repeat(MAX_TITLE_LENGTH + 1), authors: tooMany }));
    expect(!result.ok && result.errors.title).toBeTruthy();
    expect(!result.ok && result.errors.authors).toBeTruthy();
  });

  it.each(['abc', '12.5', '-3', '0', '1e3', String(MAX_PAGE_COUNT + 1)])(
    'rechaza un número de páginas inválido: %s',
    (pageCount) => {
      const result = parseBookForm(form({ pageCount }));
      expect(!result.ok && result.errors.pageCount).toBeTruthy();
    },
  );

  it('acepta el máximo de páginas permitido', () => {
    expect(parseBookForm(form({ pageCount: String(MAX_PAGE_COUNT) })).ok).toBe(true);
  });

  it('el orden en la saga requiere el nombre de la saga', () => {
    const result = parseBookForm(form({ seriesOrder: '2' }));
    expect(!result.ok && result.errors.seriesOrder).toBeTruthy();
  });

  it.each(['uno', '1.5', '-1', '1001'])('rechaza un orden en la saga inválido: %s', (seriesOrder) => {
    const result = parseBookForm(form({ seriesName: 'Saga', seriesOrder }));
    expect(!result.ok && result.errors.seriesOrder).toBeTruthy();
  });

  it('acepta el orden 0 (precuelas o novelas cortas)', () => {
    const result = parseBookForm(form({ seriesName: 'Saga', seriesOrder: '0' }));
    expect(result.ok && result.data.seriesOrder).toBe(0);
  });

  it('rechaza un estado de lectura desconocido', () => {
    const result = parseBookForm(form({ status: 'leyendo' as never }));
    expect(!result.ok && result.errors.status).toBeTruthy();
  });

  it('informa todos los errores a la vez', () => {
    const result = parseBookForm(form({ title: '', pageCount: 'x', seriesOrder: '1' }));
    expect(!result.ok && Object.keys(result.errors).sort()).toEqual(['pageCount', 'seriesOrder', 'title']);
  });
});
