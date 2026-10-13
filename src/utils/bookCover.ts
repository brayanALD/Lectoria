import { palette } from '../theme/colors';

// Artículos y preposiciones que no aportan a las iniciales («El nombre del viento» → NV).
const STOP_WORDS = new Set(['el', 'la', 'los', 'las', 'un', 'una', 'de', 'del', 'al', 'y', 'the', 'a', 'an', 'of']);

/** Hasta dos iniciales en mayúscula del título, saltando artículos y preposiciones. */
export function getCoverInitials(title: string): string {
  const words = title.trim().split(/\s+/).filter(Boolean);
  const significant = words.filter((word) => !STOP_WORDS.has(word.toLowerCase()));
  const chosen = significant.length > 0 ? significant : words;

  if (chosen.length === 0) return '?';
  // Array.from respeta los caracteres fuera del plano básico (emojis, etc.).
  if (chosen.length === 1) return Array.from(chosen[0]).slice(0, 2).join('').toLocaleUpperCase();
  return (Array.from(chosen[0])[0] + Array.from(chosen[1])[0]).toLocaleUpperCase();
}

export interface CoverColors {
  background: string;
  foreground: string;
}

// Solo colores de la paleta oficial. Contraste del texto sobre cada fondo (WCAG): Porcelain/Hunter Green 7,35:1,
// Porcelain/Olive Bark 5,43:1, Porcelain/Evergreen 14,13:1, Evergreen/Soft Fawn 6,78:1.
const COVER_COLORS: readonly CoverColors[] = [
  { background: palette.hunterGreen, foreground: palette.porcelain },
  { background: palette.oliveBark, foreground: palette.porcelain },
  { background: palette.evergreen, foreground: palette.porcelain },
  { background: palette.softFawn, foreground: palette.evergreen },
];

/** Color de la portada de reemplazo. Es estable: el mismo título siempre da el mismo color. */
export function getCoverColors(title: string): CoverColors {
  // Sin tildes ni mayúsculas, para que «Cien años» y «cien anos» coincidan.
  const normalized = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

  let hash = 5381;
  for (let i = 0; i < normalized.length; i++) hash = (hash * 33 + normalized.charCodeAt(i)) >>> 0;
  return COVER_COLORS[hash % COVER_COLORS.length];
}
