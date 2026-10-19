import type { ReadingStatus } from '../types/book';
import { describeAuthor, getAuthorBooks, summarizeAuthors } from './authors';

const book = (title: string, authors: string[], status: ReadingStatus = 'want_to_read', acquisition: 'owned' | 'wishlist' = 'owned') => ({
  title,
  authors,
  status,
  acquisition,
});

describe('summarizeAuthors', () => {
  it('cuenta los libros, los terminados y los deseos de cada autor', () => {
    const summary = summarizeAuthors([
      book('Dune', ['Frank Herbert'], 'finished'),
      book('Dune Messiah', ['Frank Herbert'], 'reading'),
      book('Hijos de Dune', ['frank herbert'], 'want_to_read', 'wishlist'),
      book('Ubik', ['Philip K. Dick'], 'finished'),
    ]);
    expect(summary).toEqual([
      { name: 'Frank Herbert', books: 3, finished: 1, wishlist: 1 },
      { name: 'Philip K. Dick', books: 1, finished: 1, wishlist: 0 },
    ]);
  });

  it('un libro con varios autores cuenta para cada uno', () => {
    const summary = summarizeAuthors([book('Buenos presagios', ['Neil Gaiman', 'Terry Pratchett'], 'finished')]);
    expect(summary.map((author) => [author.name, author.books, author.finished])).toEqual([
      ['Neil Gaiman', 1, 1],
      ['Terry Pratchett', 1, 1],
    ]);
  });

  it('un libro sin el dato de adquisición cuenta como propio', () => {
    const [author] = summarizeAuthors([{ authors: ['Ana'], status: 'finished' as const }]);
    expect(author.wishlist).toBe(0);
  });

  it('sin libros no hay autores', () => {
    expect(summarizeAuthors([])).toEqual([]);
  });
});

describe('getAuthorBooks', () => {
  const books = [book('Zeta', ['Ana']), book('Alfa', ['ANA', 'Luis']), book('Otro', ['Luis'])];

  it('devuelve los libros del autor sin distinguir mayúsculas ni tildes, por título', () => {
    expect(getAuthorBooks(books, 'ana').map((item) => item.title)).toEqual(['Alfa', 'Zeta']);
  });

  it('un autor desconocido no tiene libros', () => {
    expect(getAuthorBooks(books, 'Nadie')).toEqual([]);
  });

  it('no modifica la lista original', () => {
    const copy = [...books];
    getAuthorBooks(books, 'Ana');
    expect(books).toEqual(copy);
  });
});

describe('describeAuthor', () => {
  it('dice cuántos libros hay y, si los hay, cuántos están terminados', () => {
    expect(describeAuthor({ books: 1, finished: 0 })).toBe('1 libro');
    expect(describeAuthor({ books: 3, finished: 1 })).toBe('3 libros · 1 terminado');
    expect(describeAuthor({ books: 4, finished: 2 })).toBe('4 libros · 2 terminados');
  });
});
