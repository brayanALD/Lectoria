import { findDuplicateBook } from './bookDuplicates';

const dune = { id: '1', title: 'Dune', authors: ['Frank Herbert'], isbn13: '9780441013593' };
const cien = { id: '2', title: 'Cien años de soledad', authors: ['Gabriel García Márquez'] };
const books = [dune, cien];

describe('findDuplicateBook', () => {
  it('encuentra un libro con el mismo ISBN aunque el título sea distinto', () => {
    expect(findDuplicateBook(books, { isbn13: '9780441013593', title: 'Duna', authors: ['Otro'] })).toBe(dune);
  });

  it('encuentra un libro con el mismo título y autor, sin distinguir tildes ni mayúsculas', () => {
    expect(findDuplicateBook(books, { title: 'CIEN AÑOS DE SOLEDAD', authors: ['gabriel garcia marquez'] })).toBe(cien);
  });

  it('no confunde dos libros con el mismo título pero distinto autor', () => {
    expect(findDuplicateBook(books, { title: 'Dune', authors: ['Brian Herbert'] })).toBeUndefined();
  });

  it('no confunde libros con el mismo autor y distinto título', () => {
    expect(findDuplicateBook(books, { title: 'El mesías de Dune', authors: ['Frank Herbert'] })).toBeUndefined();
  });

  it('con el mismo título basta si falta el autor en alguno de los dos lados', () => {
    expect(findDuplicateBook(books, { title: 'Dune', authors: [] })).toBe(dune);
    expect(findDuplicateBook([{ id: '3', title: 'Sin autor', authors: [] }], { title: 'sin autor', authors: ['Ana'] })).toBeDefined();
  });

  it('un ISBN distinto no impide detectar el duplicado por título y autor', () => {
    expect(findDuplicateBook(books, { isbn13: '9780306406157', title: 'Dune', authors: ['Frank Herbert'] })).toBe(dune);
  });

  it('devuelve undefined si no hay coincidencias o la biblioteca está vacía', () => {
    expect(findDuplicateBook(books, { title: 'Otro libro', authors: ['Alguien'] })).toBeUndefined();
    expect(findDuplicateBook([], { title: 'Dune', authors: ['Frank Herbert'] })).toBeUndefined();
  });
});
