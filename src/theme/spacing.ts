export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
} as const;

// Alto mínimo de los elementos táctiles (pt); WCAG 2.5.8 exige 24 y las guías móviles recomiendan 44-48.
export const minTouchSize = 48;

export const iconSize = {
  sm: 20,
  md: 24,
  lg: 28,
  xl: 56,
} as const;

// Opacidades de estado. `skeleton` es la más baja del latido de los marcadores de carga.
export const opacity = {
  pressed: 0.85,
  disabled: 0.5,
  skeleton: 0.5,
} as const;
