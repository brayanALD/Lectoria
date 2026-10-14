import { sessionsOfBook, sortSessions } from './sessionList';

const at = (millis: number) => ({ toMillis: () => millis });
const session = (id: string, date: number, createdAt: number, bookId = 'b1') => ({
  id,
  bookId,
  date: at(date),
  createdAt: at(createdAt),
});

describe('sortSessions', () => {
  it('ordena de la sesión más reciente a la más antigua', () => {
    const sorted = sortSessions([session('a', 100, 1), session('c', 300, 1), session('b', 200, 1)]);
    expect(sorted.map((s) => s.id)).toEqual(['c', 'b', 'a']);
  });

  it('con la misma fecha, primero la registrada después', () => {
    const sorted = sortSessions([session('a', 100, 5), session('b', 100, 9), session('c', 100, 7)]);
    expect(sorted.map((s) => s.id)).toEqual(['b', 'c', 'a']);
  });

  it('con todo igual, desempata por id para que el orden no cambie', () => {
    const sorted = sortSessions([session('b', 100, 1), session('a', 100, 1)]);
    expect(sorted.map((s) => s.id)).toEqual(['a', 'b']);
  });

  it('no modifica la lista original y acepta una lista vacía', () => {
    const original = [session('a', 100, 1), session('b', 200, 1)];
    sortSessions(original);
    expect(original.map((s) => s.id)).toEqual(['a', 'b']);
    expect(sortSessions([])).toEqual([]);
  });
});

describe('sessionsOfBook', () => {
  it('devuelve solo las sesiones del libro, conservando el orden', () => {
    const sessions = [session('a', 3, 1, 'x'), session('b', 2, 1, 'y'), session('c', 1, 1, 'x')];
    expect(sessionsOfBook(sessions, 'x').map((s) => s.id)).toEqual(['a', 'c']);
    expect(sessionsOfBook(sessions, 'z')).toEqual([]);
  });
});
