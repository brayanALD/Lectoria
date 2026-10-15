export const fontSize = {
  xs: 12,
  sm: 13,
  md: 16,
  lg: 20,
  xl: 28,
} as const;

// Familias tipográficas. Cada peso es un archivo distinto (`src/theme/fonts.ts`): en una familia personalizada,
// `fontWeight` no elige el archivo en Android, así que el peso se expresa SIEMPRE con la familia y no se usa `fontWeight`.
// Figtree (sans limpia) para la interfaz; Literata (serif pensada para lectura prolongada) para títulos y cifras
// protagonistas. Si las fuentes no llegan a cargarse, la app sigue con la fuente del sistema.
export const fontFamily = {
  regular: 'Figtree_400Regular',
  semibold: 'Figtree_600SemiBold',
  bold: 'Figtree_700Bold',
  display: 'Literata_600SemiBold',
  displayBold: 'Literata_700Bold',
} as const;

// Tope del escalado de texto del sistema para elementos de tamaño acotado (etiquetas, insignias);
// el resto del texto escala sin límite.
export const maxFontScale = 1.4;
