import { normalizeText } from './bookFilters';

export interface NameGroup<T> {
  /** El nombre sin tildes ni mayúsculas: lo que identifica al grupo. */
  key: string;
  /** El nombre visible: la grafía más repetida (en un empate, la primera que apareció). */
  name: string;
  /** Los elementos del grupo, una sola vez cada uno, en el orden recibido. */
  items: T[];
}

/**
 * Agrupa elementos por un nombre (autor, saga…) sin distinguir tildes ni mayúsculas: «Frank Herbert» y «frank herbert»
 * son la misma persona. Un elemento que repite el nombre cuenta una sola vez. Orden: alfabético en español.
 */
export function groupByName<T>(items: readonly T[], getNames: (item: T) => readonly string[]): NameGroup<T>[] {
  const groups = new Map<string, { spellings: Map<string, number>; items: T[] }>();

  for (const item of items) {
    const seenInItem = new Set<string>();
    for (const raw of getNames(item)) {
      const spelling = raw.trim().replace(/\s+/g, ' ');
      const key = normalizeText(spelling);
      if (!key || seenInItem.has(key)) continue;
      seenInItem.add(key);

      let group = groups.get(key);
      if (!group) {
        group = { spellings: new Map(), items: [] };
        groups.set(key, group);
      }
      group.spellings.set(spelling, (group.spellings.get(spelling) ?? 0) + 1);
      group.items.push(item);
    }
  }

  return [...groups]
    .map(([key, group]) => ({ key, name: mostRepeated(group.spellings), items: group.items }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
}

function mostRepeated(spellings: Map<string, number>): string {
  let best = '';
  let bestCount = 0;
  for (const [spelling, count] of spellings) {
    if (count > bestCount) {
      best = spelling;
      bestCount = count;
    }
  }
  return best;
}
