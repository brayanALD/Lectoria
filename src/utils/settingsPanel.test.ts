import { getPanelWidth, PANEL_MAX_RATIO, PANEL_MIN_WIDTH, PANEL_RATIO } from './settingsPanel';

describe('getPanelWidth', () => {
  it('en pantallas grandes ocupa la mitad', () => {
    expect(getPanelWidth(1000)).toBe(500);
    expect(getPanelWidth(800)).toBe(400);
  });

  it('en un teléfono usa el ancho mínimo, que es más de la mitad', () => {
    expect(getPanelWidth(360)).toBe(PANEL_MIN_WIDTH);
    expect(getPanelWidth(412)).toBe(PANEL_MIN_WIDTH);
    expect(getPanelWidth(360)).toBeGreaterThan(360 * PANEL_RATIO);
  });

  it('justo donde la mitad iguala al mínimo (560 pt) empieza a ser la mitad', () => {
    expect(getPanelWidth(560)).toBe(280);
    expect(getPanelWidth(600)).toBe(300);
  });

  it('en pantallas muy estrechas nunca tapa más del 85 %, para poder cerrar tocando fuera', () => {
    expect(getPanelWidth(320)).toBe(Math.round(320 * PANEL_MAX_RATIO));
    expect(getPanelWidth(200)).toBe(170);
    for (const width of [200, 320, 360, 412, 560, 800, 1200]) {
      expect(getPanelWidth(width)).toBeLessThanOrEqual(width * PANEL_MAX_RATIO);
    }
  });

  it('el ancho crece de forma monótona con la pantalla', () => {
    const widths = [200, 280, 320, 360, 420, 560, 700, 900].map(getPanelWidth);
    expect([...widths].sort((a, b) => a - b)).toEqual(widths);
  });
});
