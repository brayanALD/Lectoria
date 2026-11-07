import { layout, spacing } from '../theme/spacing';

/** Las columnas de la cuadrícula de la biblioteca en un teléfono (y el mínimo en cualquier ancho). */
export const MIN_GRID_COLUMNS = 2;
const MAX_GRID_COLUMNS = 6;
// Ancho con el que la lista de la biblioteca se parte en dos columnas.
const TWO_COLUMN_LIST_MIN_WIDTH = 720;

/** Separación entre tarjetas de la biblioteca (la misma que su relleno). */
export const CARD_GAP = spacing.sm + spacing.xs;

export interface LayoutInfo {
  /** Estamos en la web (la app móvil nunca cambia de disposición). */
  isWeb: boolean;
  /** Disposición de escritorio: barra lateral, columna de contenido centrada y hojas convertidas en diálogos. */
  isWide: boolean;
  /** Ancho disponible para el contenido de una pantalla (descontada la barra lateral y acotado a la columna). */
  contentWidth: number;
  /** Columnas de la cuadrícula de libros. */
  gridColumns: number;
  /** Columnas de la lista de libros. */
  listColumns: number;
}

/**
 * Cómo se dispone la interfaz según la plataforma y el ancho de la ventana. Pura: la plataforma y el ancho se pasan, así
 * se prueba sin pantalla. En móvil siempre es la disposición de siempre (2 columnas, sin barra lateral).
 */
export function getLayout(platform: string, windowWidth: number): LayoutInfo {
  const isWeb = platform === 'web';
  const isWide = isWeb && windowWidth >= layout.wideBreakpoint;
  if (!isWeb) {
    return { isWeb, isWide, contentWidth: windowWidth, gridColumns: MIN_GRID_COLUMNS, listColumns: 1 };
  }

  const available = isWide ? windowWidth - layout.sidebarWidth : windowWidth;
  const contentWidth = Math.min(available, layout.contentMaxWidth);
  // Lo que queda dentro del relleno de la pantalla (spacing.lg por lado).
  const inner = contentWidth - spacing.lg * 2;
  const fit = Math.floor((inner + CARD_GAP) / (layout.gridCardMinWidth + CARD_GAP));
  const gridColumns = Math.max(MIN_GRID_COLUMNS, Math.min(MAX_GRID_COLUMNS, fit));
  const listColumns = contentWidth >= TWO_COLUMN_LIST_MIN_WIDTH ? 2 : 1;
  return { isWeb, isWide, contentWidth, gridColumns, listColumns };
}
