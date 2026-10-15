/** Proporción del ancho de pantalla que ocupa el panel de configuración al desplegarse. */
export const PANEL_RATIO = 0.5;
/** Ancho mínimo para que el contenido se lea y se pueda tocar bien (en un teléfono, el 50 % se queda corto). */
export const PANEL_MIN_WIDTH = 280;
/** El panel nunca tapa por completo la pantalla: siempre deja a la vista una franja para cerrarlo tocando fuera. */
export const PANEL_MAX_RATIO = 0.85;

/**
 * Ancho del panel: la mitad de la pantalla; en pantallas pequeñas (teléfonos) sube hasta el mínimo que da una buena
 * experiencia y nunca pasa del 85 % para dejar una franja visible.
 */
export function getPanelWidth(screenWidth: number): number {
  return Math.round(Math.min(screenWidth * PANEL_MAX_RATIO, Math.max(screenWidth * PANEL_RATIO, PANEL_MIN_WIDTH)));
}
