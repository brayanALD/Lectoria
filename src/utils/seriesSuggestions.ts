import { normalizeText } from './bookFilters';

export const MAX_SERIES_SUGGESTIONS = 5;

/**
 * Sagas ya registradas que coinciden con lo que la persona va escribiendo (sin distinguir tildes ni mayúsculas).
 * Orden: primero las que empiezan por el texto, luego las que tienen una palabra que empieza por él y, por
 * último, las que lo contienen en cualquier parte; dentro de cada grupo, alfabético en español.
 * No sugiere nada con el campo vacío ni la saga escrita exactamente igual; sí una con distinta grafía
 * («dune» → «Dune»), para poder adoptar el nombre ya registrado y no crear una saga duplicada por una tilde.
 */
export function getSeriesSuggestions(
  seriesNames: readonly string[],
  query: string,
  limit: number = MAX_SERIES_SUGGESTIONS,
): string[] {
  const needle = normalizeText(query);
  if (!needle) return [];

  const typed = query.trim().replace(/\s+/g, ' ');
  const seen = new Set<string>();
  const matches: { name: string; rank: number }[] = [];

  for (const raw of seriesNames) {
    const name = raw.trim();
    const key = normalizeText(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    if (name === typed) continue;

    const rank = key.startsWith(needle) ? 0 : key.split(' ').some((word) => word.startsWith(needle)) ? 1 : key.includes(needle) ? 2 : -1;
    if (rank >= 0) matches.push({ name, rank });
  }

  return matches
    .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }))
    .slice(0, limit)
    .map((match) => match.name);
}
