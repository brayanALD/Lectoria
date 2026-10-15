import { colors, palette } from './colors';

// Luminancia y contraste según WCAG 2.x.
function luminance(hex: string): number {
  const value = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(value >> 16) & 255, (value >> 8) & 255, value & 255].map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Color resultante de poner un `rgba(r, g, b, a)` sobre un fondo opaco (para medir el contraste real de un velo). */
function over(rgba: string, background: string): string {
  const [r, g, b, a] = rgba.match(/[\d.]+/g)!.map(Number);
  const base = parseInt(background.slice(1), 16);
  const mix = (top: number, bottom: number) => Math.round(top * a + bottom * (1 - a));
  const value = (mix(r, (base >> 16) & 255) << 16) | (mix(g, (base >> 8) & 255) << 8) | mix(b, base & 255);
  return `#${value.toString(16).padStart(6, '0')}`;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

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

  it('todos los colores opacos de los tokens son de la paleta o el único color añadido (error)', () => {
    const allowed = new Set<string>([...Object.values(palette), colors.error]);
    for (const [name, value] of Object.entries(colors)) {
      if (value.startsWith('#')) expect([name, allowed.has(value)]).toEqual([name, true]);
    }
  });

  it('las transparencias derivan de colores de la paleta', () => {
    expect(colors.border).toBe('rgba(20, 40, 29, 0.12)'); // Evergreen
    expect(colors.overlay).toBe('rgba(20, 40, 29, 0.5)'); // Evergreen
    expect(colors.pressed).toBe('rgba(53, 88, 52, 0.85)'); // Hunter Green
  });
});

describe('contraste de los tokens (accesibilidad visual)', () => {
  // Texto normal: WCAG 1.4.3 exige 4,5:1. Componentes de interfaz: WCAG 1.4.11 exige 3:1.
  const text: [string, string, string][] = [
    ['texto principal sobre fondo', colors.textPrimary, colors.background],
    ['texto secundario sobre fondo', colors.textSecondary, colors.background],
    ['texto secundario sobre superficie', colors.textSecondary, colors.surface],
    ['texto primario (botones secundarios y enlaces) sobre fondo', colors.primary, colors.background],
    ['texto sobre botón primario', colors.onPrimary, colors.primary],
    ['texto sobre acento', colors.onAccent, colors.accent],
    ['texto de error sobre fondo', colors.error, colors.background],
    ['texto de éxito sobre fondo', colors.success, colors.background],
    ['texto sobre la etiqueta «Terminado»', colors.background, colors.textPrimary],
  ];

  it.each(text)('%s cumple 4,5:1', (_name, foreground, background) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });

  const controls: [string, string, string][] = [
    ['borde de campos y etiquetas (outline) sobre fondo', colors.outline, colors.background],
    ['borde de botones secundarios sobre fondo', colors.primary, colors.background],
    ['borde de acciones destructivas sobre fondo', colors.error, colors.background],
  ];

  it.each(controls)('%s cumple 3:1', (_name, foreground, background) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(3);
  });

  it('el color de acento no se usa para texto sobre el fondo claro (no cumple contraste)', () => {
    expect(contrast(colors.accent, colors.background)).toBeLessThan(3);
  });
});

describe('superficies derivadas de la paleta (surfaceTint y accentSoft)', () => {
  const tint = over(colors.surfaceTint, colors.background);
  const soft = over(colors.accentSoft, colors.background);

  it('son transparencias de colores de la paleta, no colores nuevos', () => {
    expect(colors.surfaceTint).toBe('rgba(53, 88, 52, 0.07)'); // Hunter Green
    expect(colors.accentSoft).toBe('rgba(194, 168, 120, 0.32)'); // Soft Fawn
  });

  it.each([
    ['texto principal sobre la superficie tonal', colors.textPrimary, tint],
    ['texto secundario sobre la superficie tonal', colors.textSecondary, tint],
    ['texto primario (enlaces y cifras) sobre la superficie tonal', colors.primary, tint],
    ['texto de error sobre la superficie tonal', colors.error, tint],
    ['texto de éxito sobre la superficie tonal', colors.success, tint],
    ['texto principal sobre el dorado suave', colors.textPrimary, soft],
    ['texto primario sobre el dorado suave', colors.primary, soft],
  ])('%s cumple 4,5:1', (_name, foreground, background) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });

  it('el icono sobre el círculo dorado suave cumple 3:1', () => {
    expect(contrast(colors.onAccent, soft)).toBeGreaterThanOrEqual(3);
  });

  it('la superficie tonal es decorativa: no vale como borde de un control (se distingue poco del fondo)', () => {
    expect(contrast(tint, colors.background)).toBeLessThan(3);
  });
});
