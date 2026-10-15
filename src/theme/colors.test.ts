import { colors, darkColors, isDark, lightColors, palette, type ColorTokens } from './colors';

// Luminancia y contraste según WCAG 2.x. Los colores pueden venir como #rrggbb, rgb() o rgba(): un color translúcido
// se compone sobre el fondo del tema antes de medirlo (es lo que realmente ve la persona).
type Rgb = [number, number, number];

function parse(color: string): { rgb: Rgb; alpha: number } {
  if (color.startsWith('#')) {
    const value = parseInt(color.slice(1), 16);
    return { rgb: [(value >> 16) & 255, (value >> 8) & 255, value & 255], alpha: 1 };
  }
  const [r, g, b, a] = color.match(/[\d.]+/g)!.map(Number);
  return { rgb: [r, g, b], alpha: a ?? 1 };
}

function over(color: string, background: string): Rgb {
  const { rgb, alpha } = parse(color);
  const base = parse(background).rgb;
  return rgb.map((channel, i) => Math.round(channel * alpha + base[i] * (1 - alpha))) as Rgb;
}

function luminance([r, g, b]: Rgb): number {
  const [lr, lg, lb] = [r, g, b].map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

/** Contraste entre dos colores del tema, compuestos sobre su fondo. */
function contrast(a: string, b: string, background: string): number {
  const [light, dark] = [luminance(over(a, background)), luminance(over(b, background))].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

const errorHexes = ['#B3261E', '#F0A19B'];

describe('paleta oficial', () => {
  it('conserva los valores originales de docs/palette-original.txt', () => {
    expect(palette).toEqual({
      evergreen: '#14281D',
      hunterGreen: '#355834',
      oliveBark: '#6E633D',
      softFawn: '#C2A878',
      porcelain: '#F1F5F2',
    });
  });

  it('los dos temas definen exactamente los mismos tokens', () => {
    expect(Object.keys(darkColors).sort()).toEqual(Object.keys(lightColors).sort());
  });

  it('el tema activo es el claro cuando el sistema no está en oscuro (en las pruebas)', () => {
    expect(isDark).toBe(false);
    expect(colors).toBe(lightColors);
  });
});

describe.each([
  ['claro', lightColors],
  ['oscuro', darkColors],
] as [string, ColorTokens][])('tema %s', (_name, theme) => {
  const bg = theme.background;

  it('los colores opacos en hex son de la paleta o los colores de error (el resto deriva de ella)', () => {
    const allowed = new Set<string>([...Object.values(palette), ...errorHexes]);
    for (const [token, value] of Object.entries(theme)) {
      if (value.startsWith('#')) expect([token, allowed.has(value)]).toEqual([token, true]);
    }
  });

  // Texto normal: WCAG 1.4.3 exige 4,5:1.
  const text: [string, string, string][] = [
    ['texto principal sobre fondo', theme.textPrimary, theme.background],
    ['texto secundario sobre fondo', theme.textSecondary, theme.background],
    ['texto secundario sobre superficie', theme.textSecondary, theme.surface],
    ['texto primario (botones secundarios y enlaces) sobre fondo', theme.primary, theme.background],
    ['texto sobre botón primario', theme.onPrimary, theme.primary],
    ['texto sobre acento', theme.onAccent, theme.accent],
    ['texto de error sobre fondo', theme.error, theme.background],
    ['texto de éxito sobre fondo', theme.success, theme.background],
    ['texto sobre la etiqueta «Terminado»', theme.background, theme.textPrimary],
    ['texto principal sobre la superficie tonal', theme.textPrimary, theme.surfaceTint],
    ['texto secundario sobre la superficie tonal', theme.textSecondary, theme.surfaceTint],
    ['texto primario sobre la superficie tonal', theme.primary, theme.surfaceTint],
    ['texto de error sobre la superficie tonal', theme.error, theme.surfaceTint],
    ['texto de éxito sobre la superficie tonal', theme.success, theme.surfaceTint],
    ['texto principal sobre la superficie elevada', theme.textPrimary, theme.surfaceRaised],
    ['texto secundario sobre la superficie elevada', theme.textSecondary, theme.surfaceRaised],
    ['texto principal sobre el dorado suave', theme.textPrimary, theme.accentSoft],
    ['texto sobre la marca clara', theme.onBrandSurface, theme.brandSurface],
  ];

  it.each(text)('%s cumple 4,5:1', (_label, foreground, background) => {
    expect(contrast(foreground, background, bg)).toBeGreaterThanOrEqual(4.5);
  });

  // Componentes de interfaz y gráficos: WCAG 1.4.11 exige 3:1.
  const controls: [string, string, string][] = [
    ['borde de campos y etiquetas (outline) sobre fondo', theme.outline, theme.background],
    ['borde de botones secundarios sobre fondo', theme.primary, theme.background],
    ['borde de acciones destructivas sobre fondo', theme.error, theme.background],
    ['icono sobre el círculo dorado', theme.onAccent, theme.accent],
    ['icono principal sobre el dorado suave', theme.primary, theme.accentSoft],
    ['borde del botón de Google sobre la marca clara', theme.brandOutline, theme.brandSurface],
  ];

  it.each(controls)('%s cumple 3:1', (_label, foreground, background) => {
    expect(contrast(foreground, background, bg)).toBeGreaterThanOrEqual(3);
  });

  it('la superficie tonal es decorativa: se distingue poco del fondo, así que no define el borde de un control', () => {
    expect(contrast(theme.surfaceTint, theme.background, bg)).toBeLessThan(3);
  });

  it('la superficie elevada es opaca (lleva sombra) y es la tonal compuesta sobre el fondo; en el oscuro, algo más clara', () => {
    const composed = over(theme.surfaceTint, theme.background);
    const raised = parse(theme.surfaceRaised).rgb;
    expect(parse(theme.surfaceRaised).alpha).toBe(1);
    if (theme === lightColors) composed.forEach((channel, i) => expect(Math.abs(channel - raised[i])).toBeLessThanOrEqual(2));
    else expect(luminance(raised)).toBeGreaterThan(luminance(composed));
  });
});

describe('derivados de la paleta', () => {
  it('tema claro: las transparencias salen de Evergreen y Hunter Green', () => {
    expect(lightColors.border).toBe('rgba(20, 40, 29, 0.12)');
    expect(lightColors.overlay).toBe('rgba(20, 40, 29, 0.5)');
    expect(lightColors.pressed).toBe('rgba(53, 88, 52, 0.85)');
    expect(lightColors.surfaceTint).toBe('rgba(53, 88, 52, 0.07)');
    expect(lightColors.accentSoft).toBe('rgba(194, 168, 120, 0.32)');
    expect(lightColors.surfaceRaised).toBe('rgb(228, 234, 229)');
  });

  it('tema oscuro: el verde principal es Hunter Green aclarado hacia Porcelain y el resto sale de la paleta', () => {
    expect(darkColors.primary).toBe('rgb(138, 159, 138)');
    expect(darkColors.success).toBe(darkColors.primary);
    expect(darkColors.pressed).toBe('rgba(138, 159, 138, 0.85)');
    expect(darkColors.border).toBe('rgba(241, 245, 242, 0.14)');
    expect(darkColors.overlay).toBe('rgba(20, 40, 29, 0.7)');
    expect(darkColors.surfaceTint).toBe('rgba(241, 245, 242, 0.07)');
    expect(darkColors.background).toBe(palette.evergreen);
    expect(darkColors.textPrimary).toBe(palette.porcelain);
    expect(darkColors.textSecondary).toBe(palette.softFawn);
  });

  it('el dorado no vale como texto sobre el fondo claro (2,08:1), pero sí sobre el oscuro (6,78:1)', () => {
    expect(contrast(lightColors.accent, lightColors.background, lightColors.background)).toBeLessThan(3);
    expect(contrast(darkColors.accent, darkColors.background, darkColors.background)).toBeGreaterThanOrEqual(4.5);
  });

  it('la marca clara es igual en los dos temas (el logo y el botón de Google necesitan fondo claro)', () => {
    for (const token of ['brandSurface', 'onBrandSurface', 'brandOutline'] as const) {
      expect(darkColors[token]).toBe(lightColors[token]);
    }
  });
});
