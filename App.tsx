import { DarkTheme, DefaultTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { BlurTarget } from './src/components/BlurTarget';
import { SettingsPanel } from './src/components/SettingsPanel';
import { StartupScreen } from './src/components/StartupScreen';
import { AuthProvider } from './src/context/AuthContext';
import { ReadingDataProvider } from './src/context/ReadingDataContext';
import { ReadingTimerProvider } from './src/context/ReadingTimerContext';
import { SettingsProvider, useSettings } from './src/context/SettingsContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { fontFiles } from './src/theme/fonts';

// Providers en la raíz: ThemeProvider > (fuentes) > SettingsProvider > AuthProvider > ReadingDataProvider >
// ReadingTimerProvider > NavigationContainer > navigator. El panel de configuración va aparte, encima de todo.
export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <Fonts />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function Fonts() {
  const [fontsLoaded, fontError] = useFonts(fontFiles);

  // Mientras se cargan las fuentes se muestra el mismo logo que la pantalla de inicio nativa. Si fallan, la app sigue
  // con la fuente del sistema en lugar de quedarse bloqueada.
  if (!fontsLoaded && !fontError) return <StartupScreen />;

  return (
    <SettingsProvider>
      <ThemedApp />
    </SettingsProvider>
  );
}

function ThemedApp() {
  const { colors, isDark } = useTheme();
  const { visible } = useSettings();

  // La navegación toma sus colores del tema activo, así que cambia en vivo con él.
  const navigationTheme = useMemo<Theme>(() => {
    const base = isDark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.primary,
        background: colors.background,
        card: colors.surface,
        text: colors.textPrimary,
        border: colors.border,
        notification: colors.accent,
      },
    };
  }, [colors, isDark]);

  return (
    <View style={styles.root}>
      {/* Con el panel abierto, la app queda detrás (desenfocada) y no recibe el foco de los lectores de pantalla. */}
      <BlurTarget inert={visible}>
        <AuthProvider>
          <ReadingDataProvider>
            <ReadingTimerProvider>
              <NavigationContainer theme={navigationTheme}>
                <AppNavigator />
              </NavigationContainer>
            </ReadingTimerProvider>
          </ReadingDataProvider>
        </AuthProvider>
      </BlurTarget>
      <SettingsPanel />
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
