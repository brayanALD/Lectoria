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

// Tokens semánticos del tema claro. Mapa de uso: sección 5 de BookTracker_Plan_de_desarrollo.md.
// Los valores rgba derivan de la paleta (Evergreen 20,40,29 / Hunter Green 53,88,52).
export const colors = {
  background: palette.porcelain,
  surface: palette.porcelain,
  textPrimary: palette.evergreen,
  textSecondary: palette.oliveBark,
  primary: palette.hunterGreen,
  onPrimary: palette.porcelain,
  accent: palette.softFawn,
  onAccent: palette.evergreen,
  border: 'rgba(20, 40, 29, 0.12)',
  pressed: 'rgba(53, 88, 52, 0.85)',
  disabled: 'rgba(20, 40, 29, 0.38)',
  success: palette.hunterGreen,
  warning: palette.softFawn,
  error: errorLight,
} as const;
