import type { BookFormValues } from '../types/book';
import {
  EMPTY_BOOK_FORM,
  MAX_AUTHORS,
  MAX_PAGE_COUNT,
  MAX_TITLE_LENGTH,
  bookToFormValues,
  formatBookCount,
  getProgressAfterPageCountChange,
  getProgressPercent,
  planStatusChange,
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

describe('planStatusChange', () => {
  const base = { status: 'want_to_read' as const, currentPage: 0, pageCount: 300 };

  it('no cambia nada si el estado es el mismo', () => {
    expect(planStatusChange({ ...base, status: 'reading' }, 'reading')).toEqual({
      status: 'reading',
      setStartedAt: false,
      setFinishedAt: false,
      clearFinishedAt: false,
    });
  });

  it('al empezar a leer fija la fecha de inicio la primera vez', () => {
    expect(planStatusChange(base, 'reading').setStartedAt).toBe(true);
  });

  it('no pisa una fecha de inicio existente', () => {
    expect(planStatusChange({ ...base, status: 'paused', startedAt: new Date() }, 'reading').setStartedAt).toBe(false);
  });

  it('al terminar fija la fecha de fin y deja el libro en la última página', () => {
    const change = planStatusChange({ ...base, status: 'reading', currentPage: 120, startedAt: new Date() }, 'finished');
    expect(change).toMatchObject({ status: 'finished', currentPage: 300, setFinishedAt: true, setStartedAt: false });
  });

  it('al terminar sin total de páginas no toca la página actual', () => {
    const change = planStatusChange({ status: 'reading', currentPage: 50, startedAt: new Date() }, 'finished');
    expect(change.currentPage).toBeUndefined();
    expect(change.setFinishedAt).toBe(true);
  });

  it('terminar un libro que nunca se marcó como leyendo fija también el inicio', () => {
    expect(planStatusChange(base, 'finished').setStartedAt).toBe(true);
  });

  it.each(['reading', 'paused', 'abandoned', 'want_to_read'] as const)(
    'al reabrir un libro terminado (a %s) borra la fecha de fin y conserva el progreso',
    (next) => {
      const change = planStatusChange(
        { status: 'finished', currentPage: 300, pageCount: 300, startedAt: new Date(), finishedAt: new Date() },
        next,
      );
      expect(change.clearFinishedAt).toBe(true);
      expect(change.currentPage).toBeUndefined();
    },
  );

  it('abandonar o dejar pendiente no fija fecha de inicio', () => {
    expect(planStatusChange({ ...base, status: 'reading' }, 'abandoned').setStartedAt).toBe(false);
    expect(planStatusChange(base, 'abandoned').setStartedAt).toBe(false);
  });
});

describe('getProgressAfterPageCountChange', () => {
  it('no toca el progreso si no hay total de páginas', () => {
    expect(getProgressAfterPageCountChange({ status: 'reading', currentPage: 50 }, undefined)).toBeUndefined();
  });

  it('un libro terminado queda en la nueva última página', () => {
    expect(getProgressAfterPageCountChange({ status: 'finished', currentPage: 300 }, 350)).toBe(350);
    expect(getProgressAfterPageCountChange({ status: 'finished', currentPage: 300 }, 300)).toBeUndefined();
  });

  it('recorta el progreso si queda más allá del final', () => {
    expect(getProgressAfterPageCountChange({ status: 'reading', currentPage: 200 }, 150)).toBe(150);
  });

  it('conserva el progreso si cabe dentro del nuevo total', () => {
    expect(getProgressAfterPageCountChange({ status: 'reading', currentPage: 100 }, 150)).toBeUndefined();
  });
});

describe('getProgressPercent', () => {
  it('calcula el porcentaje redondeado', () => {
    expect(getProgressPercent({ currentPage: 120, pageCount: 300 })).toBe(40);
    expect(getProgressPercent({ currentPage: 1, pageCount: 3 })).toBe(33);
    expect(getProgressPercent({ currentPage: 0, pageCount: 300 })).toBe(0);
  });

  it('no supera el 100 % aunque la página actual pase del total', () => {
    expect(getProgressPercent({ currentPage: 350, pageCount: 300 })).toBe(100);
  });

  it('devuelve undefined si no se conoce el total de páginas', () => {
    expect(getProgressPercent({ currentPage: 50 })).toBeUndefined();
    expect(getProgressPercent({ currentPage: 50, pageCount: 0 })).toBeUndefined();
  });
});

describe('formatBookCount', () => {
  it('usa el singular solo para uno', () => {
    expect(formatBookCount(1)).toBe('1 libro');
    expect(formatBookCount(0)).toBe('0 libros');
    expect(formatBookCount(2)).toBe('2 libros');
    expect(formatBookCount(120)).toBe('120 libros');
  });
});

describe('bookToFormValues', () => {
  it('convierte un libro completo en texto de formulario', () => {
    expect(
      bookToFormValues({
        title: 'Dune',
        authors: ['Frank Herbert', 'Brian Herbert'],
        pageCount: 412,
        genres: ['Ciencia ficción', 'Aventura'],
        seriesName: 'Dune Chronicles',
        seriesOrder: 1,
        status: 'reading',
      }),
    ).toEqual({
      title: 'Dune',
      authors: 'Frank Herbert, Brian Herbert',
      pageCount: '412',
      genres: 'Ciencia ficción, Aventura',
      seriesName: 'Dune Chronicles',
      seriesOrder: '1',
      status: 'reading',
    });
  });

  it('deja vacíos los campos opcionales ausentes', () => {
    expect(bookToFormValues({ title: 'Dune', authors: ['Frank Herbert'], status: 'want_to_read' })).toEqual({
      ...EMPTY_BOOK_FORM,
      title: 'Dune',
      authors: 'Frank Herbert',
    });
  });

  it('conserva el orden 0 de la saga (no lo confunde con «sin valor»)', () => {
    expect(bookToFormValues({ title: 'A', authors: ['B'], status: 'paused', seriesName: 'S', seriesOrder: 0 }).seriesOrder).toBe('0');
  });

  it('es la inversa de parseBookForm: editar sin cambios devuelve los mismos datos', () => {
    const original = parseBookForm({
      ...EMPTY_BOOK_FORM,
      title: 'El nombre del viento',
      authors: 'Patrick Rothfuss',
      pageCount: '662',
      genres: 'Fantasía, Aventura',
      seriesName: 'Crónica del asesino de reyes',
      seriesOrder: '1',
      status: 'reading',
    });
    if (!original.ok) throw new Error('formulario inválido');
    const book = { ...original.data, status: original.data.status };
    expect(parseBookForm(bookToFormValues(book))).toEqual(original);
  });
});
