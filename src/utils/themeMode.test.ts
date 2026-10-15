import { parseThemeMode, resolveThemeMode, THEME_STORAGE_KEY } from './themeMode';

describe('parseThemeMode', () => {
  it('acepta solo «light» y «dark»', () => {
    expect(parseThemeMode('light')).toBe('light');
    expect(parseThemeMode('dark')).toBe('dark');
  });

  it.each([[null], [undefined], [''], ['Dark'], ['system'], ['{"mode":"dark"}']])('descarta %p', (raw) => {
    expect(parseThemeMode(raw)).toBeUndefined();
  });
});

describe('resolveThemeMode', () => {
  it('lo elegido y guardado manda sobre el sistema, en los dos sentidos', () => {
    expect(resolveThemeMode('light', 'dark')).toBe('light');
    expect(resolveThemeMode('dark', 'light')).toBe('dark');
  });

  it('sin elección guardada se usa el tema del sistema', () => {
    expect(resolveThemeMode(undefined, 'dark')).toBe('dark');
    expect(resolveThemeMode(undefined, 'light')).toBe('light');
  });

  it('sin elección ni sistema conocido (null o desconocido), claro', () => {
    expect(resolveThemeMode(undefined, null)).toBe('light');
    expect(resolveThemeMode(undefined, undefined)).toBe('light');
    expect(resolveThemeMode(undefined, 'unspecified')).toBe('light');
  });

  it('la clave de almacenamiento es estable', () => {
    expect(THEME_STORAGE_KEY).toBe('lectoria.theme');
  });
});
