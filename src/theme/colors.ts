// Paleta oficial de Lectoria (docs/palette-original.txt). No modificar estos valores.
export const palette = {
  evergreen: '#14281D',
  hunterGreen: '#355834',
  oliveBark: '#6E633D',
  softFawn: '#C2A878',
  porcelain: '#F1F5F2',
} as const;

// Único color añadido: la paleta no define un color de error (contraste 5,94:1 sobre Porcelain).
const errorLight = '#B3261E';

/** Un color de la paleta con transparencia, para no repetir sus valores RGB a mano. */
function withAlpha(hex: string, alpha: number): string {
  const value = parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

// Tokens semánticos del tema claro. Mapa de uso y contrastes: sección 5 de BookTracker_Plan_de_desarrollo.md.
// ÚNICO lugar del código donde se escriben colores: los componentes usan siempre estos tokens.
export const colors = {
  background: palette.porcelain,
  surface: palette.porcelain,
  /**
   * Superficie tonal: un velo de Hunter Green sobre Porcelain. Separa cards y bloques de datos del fondo con color en
   * lugar de bordes o sombras (profundidad sin salir de la paleta). Es decorativa: no define el borde de un control.
   */
  surfaceTint: withAlpha(palette.hunterGreen, 0.07),
  textPrimary: palette.evergreen,
  textSecondary: palette.oliveBark,
  primary: palette.hunterGreen,
  onPrimary: palette.porcelain,
  accent: palette.softFawn,
  onAccent: palette.evergreen,
  /** Dorado suave: fondo de círculos de icono e insignias (el icono o texto encima va en `onAccent`/`primary`). */
  accentSoft: withAlpha(palette.softFawn, 0.32),
  /** Separadores y bordes decorativos (no definen un control: contraste bajo a propósito). */
  border: withAlpha(palette.evergreen, 0.12),
  /** Borde de controles (campos, buscador, etiquetas): ≥ 3:1 sobre el fondo (WCAG 1.4.11). */
  outline: palette.oliveBark,
  /** Fondo atenuado tras hojas y diálogos. */
  overlay: withAlpha(palette.evergreen, 0.5),
  pressed: withAlpha(palette.hunterGreen, 0.85),
  success: palette.hunterGreen,
  warning: palette.softFawn,
  error: errorLight,
} as const;
