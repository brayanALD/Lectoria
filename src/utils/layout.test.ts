import { layout } from '../theme/spacing';
import { getLayout } from './layout';

describe('getLayout', () => {
  it('en móvil nunca cambia la disposición, sea cual sea el ancho', () => {
    for (const width of [320, 412, 768, 1200]) {
      const info = getLayout('android', width);
      expect(info).toMatchObject({ isWeb: false, isWide: false, gridColumns: 2, listColumns: 1 });
    }
    expect(getLayout('ios', 1024).isWide).toBe(false);
  });

  it('en la web estrecha (teléfono) mantiene las 2 columnas y las pestañas inferiores', () => {
    const info = getLayout('web', 390);
    expect(info).toMatchObject({ isWeb: true, isWide: false, gridColumns: 2, listColumns: 1 });
  });

  it('pasa a escritorio justo en el punto de corte', () => {
    expect(getLayout('web', layout.wideBreakpoint - 1).isWide).toBe(false);
    expect(getLayout('web', layout.wideBreakpoint).isWide).toBe(true);
  });

  it('descuenta la barra lateral del ancho del contenido y lo acota a la columna máxima', () => {
    expect(getLayout('web', 1000).contentWidth).toBe(1000 - layout.sidebarWidth);
    expect(getLayout('web', 2560).contentWidth).toBe(layout.contentMaxWidth);
  });

  it('las columnas de la cuadrícula crecen con el ancho, entre 2 y 6', () => {
    const columns = [360, 600, 900, 1100, 1440, 3000].map((width) => getLayout('web', width).gridColumns);
    expect([...columns].sort((a, b) => a - b)).toEqual(columns);
    expect(Math.min(...columns)).toBe(2);
    expect(Math.max(...columns)).toBeLessThanOrEqual(6);
    expect(getLayout('web', 1440).gridColumns).toBeGreaterThanOrEqual(4);
  });

  it('cada tarjeta de la cuadrícula respeta su ancho mínimo (salvo en el mínimo de 2 columnas)', () => {
    for (const width of [900, 1000, 1280, 1920]) {
      const info = getLayout('web', width);
      const inner = info.contentWidth - 48;
      const card = (inner - (info.gridColumns - 1) * 12) / info.gridColumns;
      expect(card).toBeGreaterThanOrEqual(layout.gridCardMinWidth);
    }
  });

  it('la lista se parte en dos columnas solo cuando hay sitio', () => {
    expect(getLayout('web', 600).listColumns).toBe(1);
    expect(getLayout('web', 1440).listColumns).toBe(2);
  });
});
