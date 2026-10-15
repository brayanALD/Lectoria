import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Appearance, View } from 'react-native';

import { darkColors, lightColors, type ColorTokens } from '../theme/colors';
import { parseThemeMode, resolveThemeMode, THEME_STORAGE_KEY, type ThemeMode } from '../utils/themeMode';

interface ThemeValue {
  mode: ThemeMode;
  isDark: boolean;
  /** Los tokens de color del tema activo: lo único que usan los componentes. */
  colors: ColorTokens;
  /** Cambia el tema en vivo (toda la app se repinta) y lo guarda para las próximas sesiones. */
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeValue | undefined>(undefined);

/**
 * El tema de la app. Arranca con el que la persona dejó elegido (o, si nunca eligió, con el del sistema), se cambia en
 * vivo con `setMode` y se guarda en el dispositivo. También se lo comunica al sistema (`Appearance.setColorScheme`) para que
 * los diálogos, el teclado y la barra de estado nativos coincidan. Va en la raíz, por encima de todo lo que pinta.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  // `undefined` = leyendo lo guardado (unos milisegundos): se pinta el fondo de la marca para no mostrar el tema equivocado.
  const [mode, setModeState] = useState<ThemeMode | undefined>(undefined);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then(parseThemeMode)
      .catch(() => undefined)
      .then((stored) => active && setModeState(resolveThemeMode(stored, Appearance.getColorScheme())));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (mode) Appearance.setColorScheme(mode);
  }, [mode]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(THEME_STORAGE_KEY, next).catch((error) => console.warn('No se pudo guardar el tema', error));
  }, []);

  const value = useMemo<ThemeValue | undefined>(
    () => (mode ? { mode, isDark: mode === 'dark', colors: mode === 'dark' ? darkColors : lightColors, setMode } : undefined),
    [mode, setMode],
  );

  if (!value) return <View style={{ flex: 1, backgroundColor: lightColors.brandSurface }} />;
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme debe usarse dentro de ThemeProvider');
  return value;
}

/**
 * Estilos que dependen del tema. Se declara a nivel de módulo, igual que `StyleSheet.create`, pero con los colores como
 * parámetro; en el componente se usa como un hook (`const styles = useStyles();`). Los estilos se vuelven a crear solo
 * cuando cambia el tema.
 */
export function makeStyles<T>(factory: (colors: ColorTokens) => T): () => T {
  return function useStyles() {
    const { colors } = useTheme();
    return useMemo(() => factory(colors), [colors]);
  };
}
