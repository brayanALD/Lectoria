import { normalizeText } from './bookFilters';

interface DuplicateCandidate {
  isbn13?: string;
  title: string;
  authors: string[];
}

/**
 * Busca en la biblioteca un libro que parezca el mismo que `candidate`:
 * mismo ISBN, o mismo título y algún autor en común (sin distinguir tildes ni mayúsculas).
 */
export function findDuplicateBook<T extends DuplicateCandidate>(books: readonly T[], candidate: DuplicateCandidate): T | undefined {
  const title = normalizeText(candidate.title);
  const authors = new Set(candidate.authors.map(normalizeText));

  return books.find((book) => {
    if (candidate.isbn13 && book.isbn13 === candidate.isbn13) return true;
    if (normalizeText(book.title) !== title) return false;
    // Un libro sin autores en alguno de los dos lados no se puede comparar por autor: basta el título.
    return authors.size === 0 || book.authors.length === 0 || book.authors.some((author) => authors.has(normalizeText(author)));
  });
}
