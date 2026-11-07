export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

// sm: portadas y detalles pequeños · md: controles (campos, botones) · lg: cards y bloques · pill: etiquetas y barras.
export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  pill: 999,
} as const;

// Alto mínimo de los elementos táctiles (pt); WCAG 2.5.8 exige 24 y las guías móviles recomiendan 44-48.
export const minTouchSize = 48;

export const iconSize = {
  sm: 20,
  md: 24,
  lg: 28,
  xl: 56,
} as const;

// Escala de un botón o card mientras se pulsa (ver `PressableScale`).
export const pressScale = 0.97;

// Opacidades de estado. `skeleton` es la más baja del latido de los marcadores de carga.
export const opacity = {
  pressed: 0.85,
  /** Puntero encima de un elemento pulsable (solo en la web): un matiz más suave que el de pulsar. */
  hover: 0.92,
  disabled: 0.5,
  skeleton: 0.5,
} as const;

// Disposición en pantallas anchas (la web de escritorio). La app móvil no las usa. Las medidas de contenido se eligen
// para que una línea de texto no se estire demasiado y los formularios no ocupen toda la pantalla.
export const layout = {
  /** Ancho de ventana desde el que la web pasa a la disposición de escritorio (barra lateral en lugar de pestañas). */
  wideBreakpoint: 900,
  /** Barra lateral de navegación. */
  sidebarWidth: 264,
  /** Ancho máximo de la columna de contenido; si la ventana es más ancha, se centra. */
  contentMaxWidth: 1040,
  /** Ancho máximo de formularios y pantallas de lectura (una sola columna). */
  formMaxWidth: 640,
  /** Ancho máximo de un diálogo (las hojas inferiores se muestran como diálogo centrado). */
  dialogMaxWidth: 520,
  /** Ancho máximo del formulario de acceso. */
  authFormMaxWidth: 400,
  /** Ancho mínimo de una tarjeta de libro en cuadrícula: de él sale el número de columnas. */
  gridCardMinWidth: 168,
} as const;
