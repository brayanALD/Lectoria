import type { ReadingStatus } from '../types/book';
import { pickDefaultBook, sortBooksForSession } from './sessionBooks';

const book = (title: string, status: ReadingStatus, updated: number) => ({
  title,
  status,
  updatedAt: { toMillis: () => updated },
});

describe('sortBooksForSession', () => {
  it('ordena por estado: leyendo, en pausa, pendiente, abandonado y terminado', () => {
    const sorted = sortBooksForSession([
      book('F', 'finished', 1),
      book('A', 'abandoned', 1),
      book('W', 'want_to_read', 1),
      book('P', 'paused', 1),
      book('R', 'reading', 1),
    ]);
    expect(sorted.map((b) => b.title)).toEqual(['R', 'P', 'W', 'A', 'F']);
  });

  it('dentro de un mismo estado, el más reciente primero', () => {
    const sorted = sortBooksForSession([book('viejo', 'reading', 10), book('nuevo', 'reading', 99), book('medio', 'reading', 50)]);
    expect(sorted.map((b) => b.title)).toEqual(['nuevo', 'medio', 'viejo']);
  });

  it('si coinciden estado y fecha, alfabético en español', () => {
    const sorted = sortBooksForSession([book('Zeta', 'reading', 1), book('Álvaro', 'reading', 1), book('Beta', 'reading', 1)]);
    expect(sorted.map((b) => b.title)).toEqual(['Álvaro', 'Beta', 'Zeta']);
  });

  it('no modifica la lista original', () => {
    const input = [book('B', 'finished', 1), book('A', 'reading', 1)];
    sortBooksForSession(input);
    expect(input.map((b) => b.title)).toEqual(['B', 'A']);
  });
});

describe('pickDefaultBook', () => {
  it('prefiere el libro que se está leyendo más reciente', () => {
    const chosen = pickDefaultBook([book('terminado', 'finished', 999), book('leyendo viejo', 'reading', 1), book('leyendo nuevo', 'reading', 50)]);
    expect(chosen?.title).toBe('leyendo nuevo');
  });

  it('sin libros en lectura, elige el primero del orden', () => {
    expect(pickDefaultBook([book('terminado', 'finished', 5), book('pendiente', 'want_to_read', 1)])?.title).toBe('pendiente');
  });

  it('devuelve undefined si no hay libros', () => {
    expect(pickDefaultBook([])).toBeUndefined();
  });
});
