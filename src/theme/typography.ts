export const fontSize = {
  xs: 12,
  sm: 13,
  md: 16,
  lg: 20,
  xl: 28,
} as const;

export const fontWeight = {
  regular: '400',
  semibold: '600',
  bold: '700',
} as const;

// Tope del escalado de texto del sistema para elementos de tamaño acotado (etiquetas, insignias);
// el resto del texto escala sin límite.
export const maxFontScale = 1.4;
