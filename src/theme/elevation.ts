import { palette } from './colors';

// Sombras: la profundidad que no basta con la superficie tonal. Cada nivel define la sombra de iOS (`shadow*`) y la de
// Android (`elevation`); se aplican con `...elevation.low` en el estilo. El fondo del elemento debe ser OPACO (por eso
// existe `colors.surfaceRaised`): con un fondo translúcido la sombra se vería a través. En el tema oscuro casi no se
// distinguen: ahí la jerarquía la da la propia superficie.
export const elevation = {
  /** Cards pulsables (libros, acciones de lectura): un apoyo sutil sobre el fondo. */
  low: {
    shadowColor: palette.evergreen,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  /** Diálogos centrados (web): flotan sobre el contenido, con la sombra hacia abajo. */
  dialog: {
    shadowColor: palette.evergreen,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 16,
  },
  /** Hojas inferiores: la sombra se proyecta hacia arriba, sobre el contenido que tapan. */
  high: {
    shadowColor: palette.evergreen,
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 12,
  },
} as const;
