import { Appearance } from 'react-native';

// Paleta oficial de Lectoria (docs/palette-original.txt). No modificar estos valores.
export const palette = {
  evergreen: '#14281D',
  hunterGreen: '#355834',
  oliveBark: '#6E633D',
  softFawn: '#C2A878',
  porcelain: '#F1F5F2',
} as const;

// Únicos colores añadidos: la paleta no define un color de error. Contraste del claro sobre Porcelain 5,94:1 y del
// oscuro sobre Evergreen ≥ 7:1.
const errorLight = '#B3261E';
const errorDark = '#F0A19B';

type Rgb = readonly [number, number, number];

function toRgb(hex: string): Rgb {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** Un color como `rgb(...)` o, con transparencia, `rgba(...)`. */
function css([r, g, b]: Rgb, alpha?: number): string {
  return alpha === undefined ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Un color de la paleta con transparencia, para no repetir sus valores RGB a mano. */
function withAlpha(hex: string, alpha: number): string {
  return css(toRgb(hex), alpha);
}

/** Mezcla opaca de dos colores de la paleta (`t` es el peso del segundo): un color derivado, no uno nuevo. */
function mix(a: string, b: string, t: number): Rgb {
  const [ar, ag, ab] = toRgb(a);
  const [br, bg, bb] = toRgb(b);
  return [Math.round(ar + (br - ar) * t), Math.round(ag + (bg - ag) * t), Math.round(ab + (bb - ab) * t)];
}

// Tokens semánticos. Mapa de uso y contrastes: sección 5 de BookTracker_Plan_de_desarrollo.md.
// ÚNICO lugar del código donde se escriben colores: los componentes usan siempre estos tokens.
// Todo color es de la paleta, el error, o una transparencia/mezcla derivada de la paleta.
const lightColors = {
  background: palette.porcelain,
  surface: palette.porcelain,
  /**
   * Superficie tonal: un velo de Hunter Green sobre Porcelain. Separa cards y bloques de datos del fondo con color en
   * lugar de bordes o sombras (profundidad sin salir de la paleta). Es decorativa: no define el borde de un control.
   */
  surfaceTint: withAlpha(palette.hunterGreen, 0.07),
  /** La misma superficie tonal, pero opaca: para lo que lleva sombra (una sombra se vería a través de un fondo translúcido). */
  surfaceRaised: css(mix(palette.porcelain, palette.hunterGreen, 0.07)),
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
  /** Color de las sombras (ver `elevation`). */
  shadow: palette.evergreen,
  /**
   * Marca sobre fondo claro, igual en los dos temas: el logo solo se ve bien sobre claro y el botón de Google exige un
   * fondo claro. En el tema claro coincide con `background`.
   */
  brandSurface: palette.porcelain,
  onBrandSurface: palette.evergreen,
  brandOutline: palette.oliveBark,
};

export type ColorTokens = { readonly [K in keyof typeof lightColors]: string };

// Tema oscuro, derivado de la misma paleta: fondo Evergreen, texto Porcelain, el dorado pasa a texto de apoyo (6,78:1)
// y `primary` es Hunter Green aclarado hacia Porcelain (Hunter Green puro sobre Evergreen solo da 1,92:1).
const sage = mix(palette.hunterGreen, palette.porcelain, 0.45);
const darkColors: ColorTokens = {
  background: palette.evergreen,
  surface: palette.evergreen,
  surfaceTint: withAlpha(palette.porcelain, 0.07),
  surfaceRaised: css(mix(palette.evergreen, palette.porcelain, 0.09)),
  textPrimary: palette.porcelain,
  textSecondary: palette.softFawn,
  primary: css(sage),
  onPrimary: palette.evergreen,
  accent: palette.softFawn,
  onAccent: palette.evergreen,
  accentSoft: withAlpha(palette.softFawn, 0.22),
  border: withAlpha(palette.porcelain, 0.14),
  outline: withAlpha(palette.softFawn, 0.65),
  overlay: withAlpha(palette.evergreen, 0.7),
  pressed: css(sage, 0.85),
  success: css(sage),
  warning: palette.softFawn,
  error: errorDark,
  shadow: palette.evergreen,
  brandSurface: palette.porcelain,
  onBrandSurface: palette.evergreen,
  brandOutline: palette.oliveBark,
};

export { darkColors, lightColors };

/**
 * ¿La app arrancó con el tema oscuro del sistema? Se decide UNA vez, al cargar la app: los estilos se crean con estos
 * valores al importarse, así que un cambio de tema del sistema con la app abierta se aplica al volver a abrirla.
 */
export const isDark = Appearance.getColorScheme() === 'dark';

/** Los tokens del tema activo: lo único que usan los componentes. */
export const colors: ColorTokens = isDark ? darkColors : lightColors;
