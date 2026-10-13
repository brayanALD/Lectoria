import { palette } from '../theme/colors';
import { getCoverColors, getCoverInitials } from './bookCover';

describe('getCoverInitials', () => {
  it('toma la inicial de las dos primeras palabras', () => {
    expect(getCoverInitials('Cien años de soledad')).toBe('CA');
    expect(getCoverInitials('Frank Herbert')).toBe('FH');
  });

  it('salta artículos y preposiciones', () => {
    expect(getCoverInitials('El nombre del viento')).toBe('NV');
    expect(getCoverInitials('The Lord of the Rings')).toBe('LR');
    expect(getCoverInitials('La casa de los espíritus')).toBe('CE');
  });

  it('con una sola palabra toma sus dos primeras letras', () => {
    expect(getCoverInitials('Dune')).toBe('DU');
    expect(getCoverInitials('1984')).toBe('19');
  });

  it('si todas las palabras son artículos, las usa igualmente', () => {
    expect(getCoverInitials('El')).toBe('EL');
    expect(getCoverInitials('La de')).toBe('LD');
  });

  it('pasa a mayúsculas, respeta los acentos y ignora espacios repetidos', () => {
    expect(getCoverInitials('  ébano   ártico ')).toBe('ÉÁ');
  });

  it('devuelve «?» para un título vacío', () => {
    expect(getCoverInitials('')).toBe('?');
    expect(getCoverInitials('   ')).toBe('?');
  });
});

describe('getCoverColors', () => {
  const allowed = new Set<string>(Object.values(palette));

  it('solo usa colores de la paleta oficial', () => {
    for (const title of ['Dune', 'Cien años de soledad', '1984', 'El nombre del viento', '', 'x', 'Ñandú']) {
      const colors = getCoverColors(title);
      expect(allowed.has(colors.background)).toBe(true);
      expect(allowed.has(colors.foreground)).toBe(true);
    }
  });

  it('es estable: el mismo título siempre da el mismo color', () => {
    expect(getCoverColors('Dune')).toEqual(getCoverColors('Dune'));
  });

  it('ignora mayúsculas, tildes y espacios en los extremos', () => {
    expect(getCoverColors('Cien Años')).toEqual(getCoverColors('  cien anos '));
  });

  it('reparte los títulos entre varios colores', () => {
    const titles = Array.from({ length: 40 }, (_, i) => `Libro número ${i}`);
    const backgrounds = new Set(titles.map((title) => getCoverColors(title).background));
    expect(backgrounds.size).toBeGreaterThanOrEqual(3);
  });

  it('nunca combina fondo y texto del mismo color', () => {
    for (let i = 0; i < 60; i++) {
      const colors = getCoverColors(`Título ${i}`);
      expect(colors.background).not.toBe(colors.foreground);
    }
  });
});
