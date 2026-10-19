import type { ReadingStatus } from '../types/book';
import { describeMissingNumbers, describeSeries, getMissingNumbers, getNextToRead, getSeriesBooks, summarizeSeries } from './series';

const book = (
  title: string,
  seriesName: string | undefined,
  seriesOrder: number | undefined,
  status: ReadingStatus = 'want_to_read',
  acquisition: 'owned' | 'wishlist' = 'owned',
) => ({ title, seriesName, seriesOrder, status, acquisition });

describe('getMissingNumbers', () => {
  it('devuelve los números que faltan entre el 1 y el mayor', () => {
    expect(getMissingNumbers([1, 2, 5])).toEqual([3, 4]);
    expect(getMissingNumbers([3])).toEqual([1, 2]);
  });

  it('una saga completa no tiene huecos', () => {
    expect(getMissingNumbers([2, 1, 3])).toEqual([]);
  });

  it('el 0 (precuela), los libros sin número y los repetidos no crean huecos', () => {
    expect(getMissingNumbers([0, 1, 1, undefined, 2])).toEqual([]);
    expect(getMissingNumbers([0])).toEqual([]);
  });

  it('sin números no hay huecos', () => {
    expect(getMissingNumbers([])).toEqual([]);
    expect(getMissingNumbers([undefined])).toEqual([]);
  });
});

describe('summarizeSeries', () => {
  it('cuenta libros, terminados, deseos y huecos de cada saga', () => {
    const summary = summarizeSeries([
      book('Dune', 'Dune', 1, 'finished'),
      book('Dune Messiah', 'dune', 2, 'reading'),
      book('Dune 4', 'Dune', 4, 'want_to_read', 'wishlist'),
      book('Suelto', undefined, undefined),
      book('Harry Potter 1', 'Harry Potter', 1, 'finished'),
    ]);
    expect(summary).toEqual([
      { name: 'Dune', books: 3, finished: 1, wishlist: 1, missing: [3] },
      { name: 'Harry Potter', books: 1, finished: 1, wishlist: 0, missing: [] },
    ]);
  });

  it('los libros sin saga no forman ninguna', () => {
    expect(summarizeSeries([book('Suelto', undefined, undefined)])).toEqual([]);
    expect(summarizeSeries([book('Vacía', '   ', undefined)])).toEqual([]);
  });
});

describe('getSeriesBooks', () => {
  const books = [
    book('Tres', 'Saga', 3),
    book('Sin número B', 'Saga', undefined),
    book('Uno', 'saga', 1),
    book('Sin número A', 'SAGA', undefined),
    book('Ajeno', 'Otra', 1),
  ];

  it('ordena por número y deja al final los que no lo tienen, por título', () => {
    expect(getSeriesBooks(books, 'Saga').map((item) => item.title)).toEqual(['Uno', 'Tres', 'Sin número A', 'Sin número B']);
  });

  it('desempata por título cuando comparten número', () => {
    const tied = [book('B', 'S', 1), book('A', 'S', 1)];
    expect(getSeriesBooks(tied, 's').map((item) => item.title)).toEqual(['A', 'B']);
  });

  it('una saga desconocida no tiene libros', () => {
    expect(getSeriesBooks(books, 'Nada')).toEqual([]);
  });
});

describe('getNextToRead', () => {
  it('es el primero en orden que es propio y no está terminado ni abandonado', () => {
    const ordered = [
      book('Uno', 'S', 1, 'finished'),
      book('Dos', 'S', 2, 'abandoned'),
      book('Tres', 'S', 3, 'want_to_read', 'wishlist'),
      book('Cuatro', 'S', 4, 'paused'),
      book('Cinco', 'S', 5, 'want_to_read'),
    ];
    expect(getNextToRead(ordered)?.title).toBe('Cuatro');
  });

  it('si el primero está en curso, ese es el siguiente', () => {
    expect(getNextToRead([book('Uno', 'S', 1, 'reading'), book('Dos', 'S', 2)])?.title).toBe('Uno');
  });

  it('si no queda nada por leer, no hay siguiente', () => {
    expect(getNextToRead([book('Uno', 'S', 1, 'finished'), book('Dos', 'S', 2, 'want_to_read', 'wishlist')])).toBeUndefined();
    expect(getNextToRead([])).toBeUndefined();
  });
});

describe('describeSeries', () => {
  it('dice cuántos libros registrados están terminados', () => {
    expect(describeSeries({ books: 4, finished: 2 })).toBe('2 de 4 terminados');
    expect(describeSeries({ books: 1, finished: 0 })).toBe('0 de 1 terminado');
  });
});

describe('describeMissingNumbers', () => {
  it('sin huecos no dice nada', () => {
    expect(describeMissingNumbers([])).toBeUndefined();
  });

  it('nombra uno, dos o varios números que faltan', () => {
    expect(describeMissingNumbers([3])).toBe('Falta el nº 3');
    expect(describeMissingNumbers([3, 4])).toBe('Faltan los nº 3 y 4');
    expect(describeMissingNumbers([3, 4, 6])).toBe('Faltan los nº 3, 4 y 6');
  });

  it('con muchos huecos resume los últimos', () => {
    expect(describeMissingNumbers([1, 2, 3, 4, 5, 6, 7, 8, 9])).toBe('Faltan los nº 1, 2, 3, 4, 5, 6 y 3 más');
    expect(describeMissingNumbers([1, 2, 3, 4], 3)).toBe('Faltan los nº 1, 2, 3 y 1 más');
  });
});
